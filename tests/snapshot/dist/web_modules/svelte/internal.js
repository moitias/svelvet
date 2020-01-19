function t() {}
function n(t) {
    return t();
}
function e() {
    return Object.create(null);
}
function o(t) {
    t.forEach(n);
}
function r(t) {
    return 'function' == typeof t;
}
function c(t, n) {
    return t != t
        ? n == n
        : t !== n || (t && 'object' == typeof t) || 'function' == typeof t;
}
function u(t, n) {
    t.appendChild(n);
}
function f(t, n, e) {
    t.insertBefore(n, e || null);
}
function i(t) {
    t.parentNode.removeChild(t);
}
function a(t) {
    return document.createElement(t);
}
function l() {
    return (t = ' '), document.createTextNode(t);
    var t;
}
function s(t, n, e) {
    null == e
        ? t.removeAttribute(n)
        : t.getAttribute(n) !== e && t.setAttribute(n, e);
}
let d;
function p(t) {
    d = t;
}
const h = [],
    $ = [],
    m = [],
    g = [],
    y = Promise.resolve();
let b = !1;
function _(t) {
    m.push(t);
}
function x() {
    const t = new Set();
    do {
        for (; h.length; ) {
            const t = h.shift();
            p(t), v(t.$$);
        }
        for (; $.length; ) $.pop()();
        for (let n = 0; n < m.length; n += 1) {
            const e = m[n];
            t.has(e) || (e(), t.add(e));
        }
        m.length = 0;
    } while (h.length);
    for (; g.length; ) g.pop()();
    b = !1;
}
function v(t) {
    if (null !== t.fragment) {
        t.update(), o(t.before_update);
        const n = t.dirty;
        (t.dirty = [-1]),
            t.fragment && t.fragment.p(t.ctx, n),
            t.after_update.forEach(_);
    }
}
const w = new Set();
function A(t, n) {
    t && t.i && (w.delete(t), t.i(n));
}
function E(t, n, e, o) {
    if (t && t.o) {
        if (w.has(t)) return;
        w.add(t),
            (void 0).c.push(() => {
                w.delete(t), o && (e && t.d(1), o());
            }),
            t.o(n);
    }
}
function k(t) {
    t && t.c();
}
function N(t, e, c) {
    const { fragment: u, on_mount: f, on_destroy: i, after_update: a } = t.$$;
    u && u.m(e, c),
        _(() => {
            const e = f.map(n).filter(r);
            i ? i.push(...e) : o(e), (t.$$.on_mount = []);
        }),
        a.forEach(_);
}
function j(t, n) {
    const e = t.$$;
    null !== e.fragment &&
        (o(e.on_destroy),
        e.fragment && e.fragment.d(n),
        (e.on_destroy = e.fragment = null),
        (e.ctx = []));
}
function C(t, n) {
    -1 === t.$$.dirty[0] &&
        (h.push(t), b || ((b = !0), y.then(x)), t.$$.dirty.fill(0)),
        (t.$$.dirty[(n / 31) | 0] |= 1 << n % 31);
}
function O(n, r, c, u, f, i, a = [-1]) {
    const l = d;
    p(n);
    const s = r.props || {},
        h = (n.$$ = {
            fragment: null,
            ctx: null,
            props: i,
            update: t,
            not_equal: f,
            bound: e(),
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(l ? l.$$.context : []),
            callbacks: e(),
            dirty: a,
        });
    let $ = !1;
    (h.ctx = c
        ? c(n, s, (t, e, ...o) => {
              const r = o.length ? o[0] : e;
              return (
                  h.ctx &&
                      f(h.ctx[t], (h.ctx[t] = r)) &&
                      (h.bound[t] && h.bound[t](r), $ && C(n, t)),
                  e
              );
          })
        : []),
        h.update(),
        ($ = !0),
        o(h.before_update),
        (h.fragment = !!u && u(h.ctx)),
        r.target &&
            (r.hydrate
                ? h.fragment &&
                  h.fragment.l(
                      (function(t) {
                          return Array.from(t.childNodes);
                      })(r.target)
                  )
                : h.fragment && h.fragment.c(),
            r.intro && A(n.$$.fragment),
            N(n, r.target, r.anchor),
            x()),
        p(l);
}
class S {
    $destroy() {
        j(this, 1), (this.$destroy = t);
    }
    $on(t, n) {
        const e = this.$$.callbacks[t] || (this.$$.callbacks[t] = []);
        return (
            e.push(n),
            () => {
                const t = e.indexOf(n);
                -1 !== t && e.splice(t, 1);
            }
        );
    }
    $set() {}
}
export {
    S as SvelteComponent,
    u as append,
    s as attr,
    k as create_component,
    j as destroy_component,
    i as detach,
    a as element,
    O as init,
    f as insert,
    N as mount_component,
    t as noop,
    c as safe_not_equal,
    l as space,
    A as transition_in,
    E as transition_out,
};
//# sourceMappingURL=internal.js.map