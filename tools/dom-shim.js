/* ==========================================================================
   Minimal DOM good enough to run DEFUSAL headless under Node.
   Supports the exact subset the game uses: element creation (HTML + SVG),
   attributes, classList, textContent, a small innerHTML parser, simple
   querySelector(All), events, and a getElementById index built from index.html.
   ========================================================================== */

function ClassList(el) { this.el = el; }
ClassList.prototype._list = function () {
  return (this.el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
};
ClassList.prototype._set = function (a) {
  this.el.setAttribute('class', a.join(' '));
};
ClassList.prototype.add = function () {
  var a = this._list();
  [].forEach.call(arguments, function (c) { if (a.indexOf(c) < 0) a.push(c); });
  this._set(a);
};
ClassList.prototype.remove = function () {
  var a = this._list(), args = [].slice.call(arguments);
  this._set(a.filter(function (c) { return args.indexOf(c) < 0; }));
};
ClassList.prototype.contains = function (c) { return this._list().indexOf(c) >= 0; };
ClassList.prototype.toggle = function (c, force) {
  var has = this.contains(c);
  var want = (force === undefined) ? !has : !!force;
  if (want) this.add(c); else this.remove(c);
  return want;
};

function TextNode(text) { this.nodeType = 3; this.text = text; }

function El(tag, ns) {
  this.nodeType = 1;
  this.tagName = String(tag).toUpperCase();
  this.localName = String(tag);
  this.ns = ns || null;
  this.attrs = {};
  this.childNodes = [];
  this.parentNode = null;
  this.handlers = {};
  this.style = {
    setProperty: function (k, v) { this[k] = v; },
    getPropertyValue: function (k) { return this[k] || ''; },
    removeProperty: function (k) { delete this[k]; }
  };
  this.offsetWidth = 0;
  this.value = '';
  this.disabled = false;
  this._hidden = false;
  this.classList = new ClassList(this);
}

Object.defineProperty(El.prototype, 'hidden', {
  get: function () { return this._hidden; },
  set: function (v) { this._hidden = !!v; }
});
Object.defineProperty(El.prototype, 'id', {
  get: function () { return this.attrs.id || ''; },
  set: function (v) { this.attrs.id = v; }
});
Object.defineProperty(El.prototype, 'className', {
  get: function () { return this.attrs['class'] || ''; },
  set: function (v) { this.attrs['class'] = String(v); }
});
Object.defineProperty(El.prototype, 'children', {
  get: function () {
    return this.childNodes.filter(function (n) { return n.nodeType === 1; });
  }
});
Object.defineProperty(El.prototype, 'textContent', {
  get: function () {
    return this.childNodes.map(function (n) {
      return n.nodeType === 3 ? n.text : n.textContent;
    }).join('');
  },
  set: function (v) { this.childNodes = [new TextNode(String(v))]; }
});
Object.defineProperty(El.prototype, 'innerHTML', {
  get: function () { return ''; },
  set: function (html) {
    this.childNodes = [];
    var kids = parseHTML(String(html));
    var self = this;
    kids.forEach(function (k) { self.appendChild(k); });
  }
});

El.prototype.setAttribute = function (k, v) {
  this.attrs[k] = String(v);
  /* the markup carries `hidden` on the screens that start closed; without
     this every screen parses as visible and any assertion on it is vacuous */
  if (k === 'hidden') this._hidden = true;
};
El.prototype.getAttribute = function (k) {
  return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
};
El.prototype.hasAttribute = function (k) {
  return Object.prototype.hasOwnProperty.call(this.attrs, k);
};
El.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
El.prototype.appendChild = function (n) {
  n.parentNode = this;
  this.childNodes.push(n);
  return n;
};
El.prototype.removeChild = function (n) {
  this.childNodes = this.childNodes.filter(function (c) { return c !== n; });
  return n;
};
El.prototype.addEventListener = function (type, fn) {
  (this.handlers[type] = this.handlers[type] || []).push(fn);
};
El.prototype.dispatch = function (type, ev) {
  (this.handlers[type] || []).forEach(function (fn) {
    fn(ev || { type: type, preventDefault: function () {} });
  });
};
El.prototype.focus = function () {};

/* --- selectors: tag, .class, [attr], tag.class ------------------------- */

function matches(el, sel) {
  sel = sel.trim();
  var m = /^\[([\w-]+)\]$/.exec(sel);
  if (m) return el.hasAttribute(m[1]);
  var parts = sel.split('.');
  var tag = parts.shift();
  if (tag && el.localName.toLowerCase() !== tag.toLowerCase()) return false;
  return parts.every(function (c) { return el.classList.contains(c); });
}

El.prototype.querySelectorAll = function (sel) {
  var out = [];
  (function walk(node) {
    node.childNodes.forEach(function (c) {
      if (c.nodeType !== 1) return;
      if (matches(c, sel)) out.push(c);
      walk(c);
    });
  })(this);
  return out;
};
El.prototype.querySelector = function (sel) {
  return this.querySelectorAll(sel)[0] || null;
};

/* --- tiny HTML parser (well-formed markup only) ------------------------- */

function parseHTML(html) {
  var stack = [], roots = [], i = 0;
  var tagRe = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  var m;
  while ((m = tagRe.exec(html)) !== null) {
    var text = html.slice(i, m.index);
    if (text.trim()) push(new TextNode(text));
    i = tagRe.lastIndex;
    if (m[1]) { stack.pop(); continue; }
    var el = new El(m[2]);
    var attrRe = /([\w:-]+)(?:="([^"]*)")?/g, a;
    while ((a = attrRe.exec(m[3])) !== null) el.setAttribute(a[1], a[2] === undefined ? '' : a[2]);
    push(el);
    if (!m[4] && ['input', 'br', 'img', 'meta', 'link'].indexOf(m[2].toLowerCase()) < 0) {
      stack.push(el);
    }
  }
  var tail = html.slice(i);
  if (tail.trim()) push(new TextNode(tail));
  return roots;

  function push(node) {
    if (stack.length) stack[stack.length - 1].appendChild(node);
    else roots.push(node);
  }
}

/* --- document ------------------------------------------------------------ */

function makeDocument(html) {
  var body = new El('body');
  if (html) {
    var bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
    parseHTML(bodyHtml ? bodyHtml[1] : html).forEach(function (n) { body.appendChild(n); });
  }
  var doc = {
    body: body,
    readyState: 'complete',
    handlers: {},
    createElement: function (t) { return new El(t); },
    createElementNS: function (ns, t) { return new El(t, ns); },
    createTextNode: function (t) { return new TextNode(t); },
    getElementById: function (id) {
      return body.querySelectorAll('[id]').filter(function (e) {
        return e.getAttribute('id') === id;
      })[0] || null;
    },
    querySelector: function (s) { return body.querySelector(s); },
    querySelectorAll: function (s) { return body.querySelectorAll(s); },
    addEventListener: function (t, fn) { (doc.handlers[t] = doc.handlers[t] || []).push(fn); },
    dispatch: function (t, ev) {
      (doc.handlers[t] || []).forEach(function (fn) { fn(ev); });
    }
  };
  return doc;
}

module.exports = { El: El, TextNode: TextNode, parseHTML: parseHTML,
                   makeDocument: makeDocument, matches: matches };

/* --- serialisation (preview rendering only) ----------------------------- */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function serialize(node) {
  if (node.nodeType === 3) return esc(node.text);
  var attrs = Object.keys(node.attrs).map(function (k) {
    return ' ' + k + '="' + String(node.attrs[k]).replace(/"/g, '&quot;') + '"';
  }).join('');
  var kids = node.childNodes.map(serialize).join('');
  return '<' + node.localName + attrs + '>' + kids + '</' + node.localName + '>';
}
module.exports.serialize = serialize;
