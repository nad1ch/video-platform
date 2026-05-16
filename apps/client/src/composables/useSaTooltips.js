import { onMounted, onUnmounted } from 'vue';
const TOOLTIP_ATTR = 'data-sa-tooltip';
const TOOLTIP_CLASS = 'sa-tooltip';
const TOOLTIP_VISIBLE_CLASS = 'sa-tooltip--visible';
const VIEWPORT_MARGIN = 12;
const TOOLTIP_GAP = 10;
const POINTER_SHOW_DELAY_MS = 650;
const POINTER_OFFSET_X = 8;
const POINTER_OFFSET_Y = 10;
let activeTarget = null;
let pendingTarget = null;
let tooltipEl = null;
let observer = null;
let rafId = 0;
let showTimer;
let lastPointerX = 0;
let lastPointerY = 0;
let hasPointerAnchor = false;
function ensureTooltipElement() {
    if (tooltipEl) {
        return tooltipEl;
    }
    const el = document.createElement('div');
    el.className = TOOLTIP_CLASS;
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
    tooltipEl = el;
    return el;
}
function sanitizeTitle(element) {
    const title = element.getAttribute('title');
    if (title === null) {
        return;
    }
    if (title.trim()) {
        element.setAttribute(TOOLTIP_ATTR, title);
    }
    element.removeAttribute('title');
}
function sanitizeTooltipTitles(root = document) {
    if (root instanceof Element) {
        sanitizeTitle(root);
    }
    root.querySelectorAll?.('[title]').forEach(sanitizeTitle);
}
function tooltipTargetFromEventTarget(target) {
    if (!(target instanceof Element)) {
        return null;
    }
    const candidate = target.closest(`[${TOOLTIP_ATTR}], [title]`);
    if (!candidate) {
        return null;
    }
    sanitizeTitle(candidate);
    return candidate.hasAttribute(TOOLTIP_ATTR) ? candidate : null;
}
function tooltipTextForTarget(target) {
    return target.getAttribute(TOOLTIP_ATTR)?.trim() ?? '';
}
function positionTooltip() {
    if (!activeTarget || !tooltipEl) {
        return;
    }
    const text = tooltipTextForTarget(activeTarget);
    if (!text) {
        hideTooltip();
        return;
    }
    tooltipEl.textContent = text;
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let placeBelow = true;
    let left;
    let top;
    if (hasPointerAnchor) {
        const preferredLeft = lastPointerX + POINTER_OFFSET_X;
        const preferredTop = lastPointerY + POINTER_OFFSET_Y;
        left = Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, viewportWidth - tooltipRect.width - VIEWPORT_MARGIN));
        top = Math.max(VIEWPORT_MARGIN, Math.min(preferredTop, viewportHeight - tooltipRect.height - VIEWPORT_MARGIN));
        if (preferredTop > viewportHeight - tooltipRect.height - VIEWPORT_MARGIN) {
            top = Math.max(VIEWPORT_MARGIN, lastPointerY - tooltipRect.height - POINTER_OFFSET_Y);
            placeBelow = false;
        }
    }
    else {
        const targetRect = activeTarget.getBoundingClientRect();
        const preferredTop = targetRect.top - tooltipRect.height - TOOLTIP_GAP;
        placeBelow = preferredTop < VIEWPORT_MARGIN;
        top = placeBelow
            ? Math.min(targetRect.bottom + TOOLTIP_GAP, viewportHeight - tooltipRect.height - VIEWPORT_MARGIN)
            : preferredTop;
        const centerLeft = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        left = Math.max(VIEWPORT_MARGIN, Math.min(centerLeft, viewportWidth - tooltipRect.width - VIEWPORT_MARGIN));
    }
    tooltipEl.dataset.placement = placeBelow ? 'bottom' : 'top';
    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(Math.max(VIEWPORT_MARGIN, top))}px`;
}
function schedulePositionTooltip() {
    if (rafId) {
        return;
    }
    rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        positionTooltip();
    });
}
function showTooltip(target) {
    const text = tooltipTextForTarget(target);
    if (!text) {
        return;
    }
    activeTarget = target;
    const el = ensureTooltipElement();
    el.textContent = text;
    el.setAttribute('aria-hidden', 'false');
    el.classList.add(TOOLTIP_VISIBLE_CLASS);
    positionTooltip();
}
function clearShowTimer() {
    if (showTimer === undefined) {
        return;
    }
    window.clearTimeout(showTimer);
    showTimer = undefined;
}
function hideTooltip() {
    clearShowTimer();
    activeTarget = null;
    pendingTarget = null;
    hasPointerAnchor = false;
    if (!tooltipEl) {
        return;
    }
    tooltipEl.classList.remove(TOOLTIP_VISIBLE_CLASS);
    tooltipEl.setAttribute('aria-hidden', 'true');
}
function handlePointerOver(event) {
    const target = tooltipTargetFromEventTarget(event.target);
    if (!target || target === activeTarget || target === pendingTarget) {
        return;
    }
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    hasPointerAnchor = true;
    pendingTarget = target;
    clearShowTimer();
    showTimer = window.setTimeout(() => {
        showTimer = undefined;
        if (pendingTarget === target) {
            showTooltip(target);
        }
    }, POINTER_SHOW_DELAY_MS);
}
function handlePointerMove(event) {
    if (!pendingTarget && !activeTarget) {
        return;
    }
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    hasPointerAnchor = true;
    if (activeTarget) {
        hideTooltip();
    }
}
function handlePointerOut(event) {
    const currentTarget = activeTarget ?? pendingTarget;
    if (!currentTarget) {
        return;
    }
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && currentTarget.contains(nextTarget)) {
        return;
    }
    hideTooltip();
}
function handleFocusIn(event) {
    const target = tooltipTargetFromEventTarget(event.target);
    if (target) {
        clearShowTimer();
        hasPointerAnchor = false;
        showTooltip(target);
    }
}
function handleFocusOut() {
    hideTooltip();
}
function handleKeydown(event) {
    if (event.key === 'Escape') {
        hideTooltip();
    }
}
function handleMutations(mutations) {
    for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
            sanitizeTitle(mutation.target);
            continue;
        }
        mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
                sanitizeTooltipTitles(node);
            }
        });
    }
}
export function useSaTooltips() {
    onMounted(() => {
        sanitizeTooltipTitles();
        observer = new MutationObserver(handleMutations);
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['title'],
        });
        document.addEventListener('pointerover', handlePointerOver, true);
        document.addEventListener('pointermove', handlePointerMove, true);
        document.addEventListener('pointerout', handlePointerOut, true);
        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('focusout', handleFocusOut, true);
        document.addEventListener('keydown', handleKeydown);
        window.addEventListener('scroll', schedulePositionTooltip, true);
        window.addEventListener('resize', schedulePositionTooltip);
    });
    onUnmounted(() => {
        observer?.disconnect();
        observer = null;
        document.removeEventListener('pointerover', handlePointerOver, true);
        document.removeEventListener('pointermove', handlePointerMove, true);
        document.removeEventListener('pointerout', handlePointerOut, true);
        document.removeEventListener('focusin', handleFocusIn, true);
        document.removeEventListener('focusout', handleFocusOut, true);
        document.removeEventListener('keydown', handleKeydown);
        window.removeEventListener('scroll', schedulePositionTooltip, true);
        window.removeEventListener('resize', schedulePositionTooltip);
        if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
        }
        tooltipEl?.remove();
        tooltipEl = null;
        activeTarget = null;
    });
}
