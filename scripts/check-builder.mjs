import { fileURLToPath } from "node:url";

/**
 * Asserts the site-builder tree operations, breakpoint cascade and HTML export.
 *
 * Two properties matter more than the rest.
 *
 * ESCAPING. The exported markup carries text somebody typed. The source escaped
 * only & < >, so a heading or an alt text containing a double quote closed its
 * own attribute and everything after it became markup — a page that renders as
 * garbage at best, and an injection hole at worst.
 *
 * THE CASCADE. Smaller breakpoints inherit from larger ones. Resolving each one
 * independently makes every mobile tweak require restating the tablet one, and
 * the two silently drift — a page that looks right on the screen it was built
 * on and wrong on every other.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/builder.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const builder = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  newNode,
  walk,
  findNode,
  parentOf,
  mapTree,
  removeNode,
  insertInto,
  cloneNode,
  canHoldChildren,
  isInSubtree,
  resolveStyle,
  styleToCss,
  exportHtml,
  resetBuilderUid,
  BUILDER_ELEMENTS,
  BUILDER_BREAKPOINTS,
} = builder;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

const node = (id, type, children, extra = {}) => ({
  id,
  type,
  props: {},
  style: {},
  children: children ?? [],
  ...extra,
});

const tree = [
  node("s1", "section", [
    node("c1", "container", [node("h1", "heading"), node("t1", "text")]),
  ]),
  node("s2", "section", [node("c2", "container", [])]),
];

/* --- catalog ----------------------------------------------------------- */

check("elements are indexed by type", BUILDER_ELEMENTS.heading.label, "Heading");
check("three breakpoints", BUILDER_BREAKPOINTS.length, 3);
check("desktop has no max width", BUILDER_BREAKPOINTS[0].max, null);
check("mobile caps at 767", BUILDER_BREAKPOINTS[2].max, 767);

check("a section holds children", canHoldChildren("section"), true);
check("a grid holds children", canHoldChildren("grid"), true);
check("a heading does not", canHoldChildren("heading"), false);
check("an image does not", canHoldChildren("image"), false);

/* --- defaults ---------------------------------------------------------- */

resetBuilderUid();
const button = newNode("button");
// A total pill, always — the one shape rule the system never breaks.
check("a button is a total pill", button.style.borderRadius, 999);
check("a button arrives with real text", typeof button.props.text, "string");

const card = newNode("card");
check("a card has no shadow", "boxShadow" in card.style, false);
check("a card has no border", "border" in card.style, false);

check("a section carries the 120px rhythm", newNode("section").style.paddingTop, 120);
check("a fresh node has an id", newNode("text").id.length > 0, true);
check("two fresh nodes differ", newNode("text").id === newNode("text").id, false);

/* --- tree walking ------------------------------------------------------- */

const seen = [];
walk(tree, (entry) => seen.push(entry.id));
check("walk visits depth first", seen.join(), "s1,c1,h1,t1,s2,c2");

check("find reaches a leaf", findNode(tree, "t1").type, "text");
check("find misses cleanly", findNode(tree, "nope"), null);

check("parentOf finds the container", parentOf(tree, "h1").id, "c1");
check("a root node has no parent", parentOf(tree, "s1"), null);

/* --- editing ------------------------------------------------------------ */

const renamed = mapTree(tree, (entry) =>
  entry.id === "h1" ? { ...entry, props: { text: "New" } } : entry,
);
check("mapTree reaches a nested node", findNode(renamed, "h1").props.text, "New");
check("mapTree leaves the rest alone", findNode(renamed, "t1").type, "text");
// The original must not be touched: undo depends on it.
check("mapTree does not mutate the source", tree[0].children[0].children[0].props.text, undefined);

const pruned = removeNode(tree, "c1");
check("the node is gone", findNode(pruned, "c1"), null);
check("its children went with it", findNode(pruned, "h1"), null);
check("its siblings survive", findNode(pruned, "s2").type, "section");

const appended = insertInto(tree, "c2", node("new", "text"));
check("insert lands in the parent", parentOf(appended, "new").id, "c2");

const atStart = insertInto(tree, "c1", node("first", "text"), 0);
check("an index places it exactly", findNode(atStart, "c1").children[0].id, "first");
check("the existing children shift", findNode(atStart, "c1").children[1].id, "h1");

const atRoot = insertInto(tree, null, node("top", "section"), 0);
check("a null parent inserts at the root", atRoot[0].id, "top");
check("the root keeps its order", atRoot[1].id, "s1");

resetBuilderUid();
const copy = cloneNode(findNode(tree, "c1"));
check("a clone has a new id", copy.id === "c1", false);
check("its children are copied", copy.children.length, 2);
// A clone that shares child ids is not a copy: editing one would edit both.
check("its children have new ids too", copy.children[0].id === "h1", false);

/* --- containment -------------------------------------------------------- */

// Dropping a node into its own subtree would detach that whole branch.
check("a node is within itself", isInSubtree(tree, "c1", "c1"), true);
check("a child is within its ancestor", isInSubtree(tree, "h1", "s1"), true);
check("a sibling is not within", isInSubtree(tree, "s2", "s1"), false);
check("an ancestor is not within its child", isInSubtree(tree, "s1", "c1"), false);

/* --- the cascade -------------------------------------------------------- */

const responsive = node("r", "heading", [], {
  style: { fontSize: 44, paddingTop: 40, color: "red" },
  responsive: {
    tablet: { fontSize: 32 },
    mobile: { paddingTop: 16 },
  },
});

check("desktop is the base style", resolveStyle(responsive, "desktop").fontSize, 44);
check("tablet applies its override", resolveStyle(responsive, "tablet").fontSize, 32);
check("tablet keeps what it does not override", resolveStyle(responsive, "tablet").paddingTop, 40);

// The inheritance is the point: mobile gets the tablet font size without
// restating it, and adds its own padding on top.
check("mobile inherits the tablet override", resolveStyle(responsive, "mobile").fontSize, 32);
check("mobile applies its own override", resolveStyle(responsive, "mobile").paddingTop, 16);
check("mobile keeps the untouched base", resolveStyle(responsive, "mobile").color, "red");

check("no responsive block is fine", resolveStyle(node("x", "text"), "mobile").fontSize, undefined);

/* --- css serialisation -------------------------------------------------- */

check("camelCase becomes kebab", styleToCss({ paddingTop: 12 }), "padding-top:12px");
check("a number gains px", styleToCss({ width: 40 }), "width:40px");
check("fontWeight stays unitless", styleToCss({ fontWeight: 600 }), "font-weight:600");
check("lineHeight stays unitless", styleToCss({ lineHeight: 1.5 }), "line-height:1.5");
check("opacity stays unitless", styleToCss({ opacity: 0.5 }), "opacity:0.5");
check("a string passes through", styleToCss({ display: "flex" }), "display:flex");
check("an empty value is dropped", styleToCss({ color: "", width: 10 }), "width:10px");
check("null is dropped", styleToCss({ color: null, width: 10 }), "width:10px");
check("an empty style is an empty string", styleToCss({}), "");
check("no style at all is an empty string", styleToCss(undefined), "");

/* --- export: escaping --------------------------------------------------- */

const nasty = [
  node("n1", "heading", [], { props: { text: '<script>alert("x")</script>', tag: "h1" } }),
  node("n2", "image", [], { props: { src: 'a" onerror="alert(1)', alt: 'say "hi"' } }),
  node("n3", "button", [], { props: { text: "Go", href: 'javascript:void(0)"' } }),
];
const html = exportHtml(nasty, 'My "page" & more');

check("a script tag is escaped", html.includes("<script>"), false);
check("the text survives escaped", html.includes("&lt;script&gt;"), true);

// The quote is the one the source missed. Without it the src attribute closes
// early and everything after becomes markup.
check("a quote in an attribute is escaped", html.includes('onerror="'), false);
check("the alt keeps its quotes escaped", html.includes("&quot;hi&quot;"), true);
check("a quote in an href is escaped", html.includes('href="javascript:void(0)"'), false);
check("a quote in the title is escaped", html.includes("<title>My &quot;page&quot; &amp; more</title>"), true);
check("an ampersand is escaped", html.includes("&amp;"), true);

// A tag from outside the fixed set must not reach the markup.
const badTag = exportHtml([node("h", "heading", [], { props: { text: "x", tag: "script" } })]);
check("an unexpected heading tag falls back", badTag.includes("<script"), false);
check("it falls back to h2", badTag.includes("<h2"), true);

/* --- export: structure --------------------------------------------------- */

const page = [
  node("s", "section", [node("c", "container", [node("h", "heading", [], { props: { text: "Hello", tag: "h1" } })])], {
    style: { paddingTop: 120 },
    responsive: { mobile: { paddingTop: 48 } },
  }),
];
const out = exportHtml(page, "Test");

check("it is a full document", out.startsWith("<!doctype html>"), true);
check("it declares the viewport", out.includes("width=device-width"), true);
check("the title is used", out.includes("<title>Test</title>"), true);
check("a base rule is emitted", out.includes(".s{padding-top:120px}"), true);
check("a breakpoint becomes a media query", out.includes("@media (max-width:767px){.s{padding-top:48px}}"), true);
check("nesting is preserved", out.indexOf('class="hl-container c"') < out.indexOf('class="hl-heading h"'), true);
check("the heading uses its tag", out.includes("<h1 class="), true);
check("a node with no style emits no rule", out.includes(".h{}"), false);

check("an empty tree still gives a document", exportHtml([], "Empty").includes("<body>"), true);

/* --- report ------------------------------------------------------------- */

let failed = 0;
for (const [name, actual, expected] of cases) {
  const ok = Object.is(actual, expected);
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(48)} -> ${JSON.stringify(actual)}${
      ok ? "" : `   expected ${JSON.stringify(expected)}`
    }`,
  );
}

console.log(`\n${cases.length - failed}/${cases.length} builder checks passed`);
if (failed) process.exit(1);
