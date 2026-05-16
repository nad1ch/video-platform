import { createPinia } from 'pinia';
import { createApp } from 'vue';
import 'ui-theme';
import './style.css';
import './tailwind.css';
import App from './App.vue';
import { router } from './router';
import { initAudioPlaybackUnlock } from 'call-core/audio-unlock';
import { i18n, preloadInitialLocales } from '@/eat-first/i18n';
import { initAnalytics } from '@/eat-first/analytics/bootstrap.js';
import { ensureMetaDescription } from '@/eat-first/constants/seo.js';
import { initClientAnalytics } from '@/utils/clientAnalytics';
import { installDiagnosticsVueErrorHandler } from '@/diagnostics';
async function bootstrap() {
    await preloadInitialLocales();
    initAudioPlaybackUnlock();
    ensureMetaDescription();
    initAnalytics();
    initClientAnalytics(router);
    const app = createApp(App);
    // Best-effort: forward Vue render/setup errors into existing client
    // error tracking AND the diagnostics ring buffer. Wrapped in
    // try/catch by the installer itself so a failure here cannot block
    // app mounting.
    installDiagnosticsVueErrorHandler(app);
    const pinia = createPinia();
    app.use(pinia);
    app.use(i18n);
    app.use(router);
    app.mount('#app');
}
void bootstrap();
