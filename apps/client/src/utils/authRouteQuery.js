export function replaceAuthQuery(route, mode) {
    const out = { mode };
    const r = route.query.redirect;
    const redir = typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : undefined;
    if (redir) {
        out.redirect = redir;
    }
    return out;
}
