import { fileURLToPath } from "node:url";

/**
 * Asserts the document model: counting, outline, and the HTML and Markdown
 * exports.
 *
 * An export is the one artefact of an editor that leaves the application, so
 * it is the one thing that has to be right without anyone looking at it.
 *
 * Three properties carry the weight:
 *
 * ATTRIBUTES ARE ESCAPED. The source interpolated src and caption straight
 * into src="…" and alt="…", so an image whose URL or caption contained a quote
 * closed the attribute and everything after became markup — and those values
 * are whatever an author typed or pasted.
 *
 * THE ORDERED COUNTER RESETS ON ANY NON-LIST BLOCK. The source reset it only
 * in its default branch, so a numbered list interrupted by a heading — a
 * document with several numbered sections — carried on counting, and the
 * second list started at 4.
 *
 * A WORD COUNT DOES NOT COUNT MARKUP. stripTags decoded &amp; but not &lt; or
 * &gt;, so escaped markup in a document reappeared as live tags in the plain
 * text and the count counted them.
 */
const { build } = await import("esbuild");
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/document.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});

const doc = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const {
  newBlock,
  resetBlockUid,
  isList,
  isMedia,
  isBoxed,
  stripTags,
  plainText,
  counts,
  outlineOf,
  videoSrc,
  toHtml,
  toMarkdown,
  moveBlock,
  removeBlock,
  duplicateBlock,
  shortcutFor,
  BLOCK_TYPES,
  SLASH_GROUPS,
} = doc;

const cases = [];
const check = (name, actual, expected) => cases.push([name, actual, expected]);

const block = (type, extra = {}) => ({ id: `x${type}${Math.random()}`, type, ...extra });

/* --- the catalogue -------------------------------------------------------- */

check("every block type has a tag", Object.values(BLOCK_TYPES).every((spec) => spec.tag), true);
check("a paragraph maps to p", BLOCK_TYPES.p.tag, "p");
check("a quote maps to blockquote", BLOCK_TYPES.quote.tag, "blockquote");
check("the palette has groups", SLASH_GROUPS.length > 0, true);

check("a bullet is a list", isList("bullet"), true);
check("a to-do is a list", isList("todo"), true);
check("a paragraph is not", isList("p"), false);
check("an image is media", isMedia("image"), true);
check("a table is not media", isMedia("table"), false);
check("a table is boxed", isBoxed("table"), true);
check("a heading is not boxed", isBoxed("h1"), false);

/* --- ids ------------------------------------------------------------------- */

resetBlockUid();
// Two blocks created in the same millisecond — what pasting a list does —
// would collide on a Date.now() id, and React would reuse one DOM node.
const rapid = Array.from({ length: 50 }, () => newBlock("p").id);
check("fifty rapid ids are unique", new Set(rapid).size, 50);
check("an id carries its prefix", newBlock("p").id.startsWith("b"), true);
check("a new block keeps its type", newBlock("h2").type, "h2");
check("a new block can carry html", newBlock("p", "<b>x</b>").html, "<b>x</b>");

/* --- text and counting ------------------------------------------------------ */

check("tags are stripped", stripTags("<b>bold</b>"), "bold");
check("nbsp becomes a space", stripTags("a&nbsp;b"), "a b");
check("an ampersand decodes", stripTags("a &amp; b"), "a & b");
// The two the source missed: escaped markup came back as live tags.
check("an escaped tag decodes to text", stripTags("&lt;script&gt;"), "<script>");
check("a quote decodes", stripTags("say &quot;hi&quot;"), 'say "hi"');

const article = [
  block("h1", { html: "Title" }),
  block("p", { html: "One two three four five." }),
  block("bullet", { html: "six" }),
  block("divider"),
  block("image", { src: "/a.png", caption: "seven" }),
];

check("plain text joins blocks", plainText(article).includes("Title"), true);
check("a divider reads as a rule", plainText(article).includes("---"), true);
check("an image contributes its caption", plainText(article).includes("seven"), true);

// Nine: the divider contributes "---", which is a word to a splitter and
// close enough to one for a reading estimate.
check("words are counted", counts(article).words, 9);
check("characters are counted", counts(article).chars > 0, true);
// "0 min read" on a document with content is worse than a rounded estimate.
check("reading time is at least a minute", counts(article).minutes, 1);
check("a long document reads longer", counts([block("p", { html: "word ".repeat(500) })]).minutes, 2);
check("an empty document counts nothing", counts([]).words, 0);

// A count built on markup would report the tags as words.
check("markup is not counted", counts([block("p", { html: "<b>one</b> <i>two</i>" })]).words, 2);

/* --- outline ----------------------------------------------------------------- */

const outline = outlineOf([
  block("h1", { html: "One" }),
  block("p", { html: "text" }),
  block("h2", { html: "<b>Two</b>" }),
  block("h3", { html: "Three" }),
]);

check("only headings appear", outline.length, 3);
check("levels are read from the type", outline.map((entry) => entry.level).join(), "1,2,3");
check("heading text is plain", outline[1].text, "Two");
check("an empty heading falls back to its label", outlineOf([block("h1", { html: "" })])[0].text, "Heading 1");

/* --- video ---------------------------------------------------------------------- */

// A watch URL in an iframe renders YouTube's refusal page, which reads as a
// bug in the document rather than in the link.
check("a youtube watch url becomes an embed", videoSrc("https://youtube.com/watch?v=abc123").src, "https://www.youtube.com/embed/abc123");
check("a youtu.be url becomes an embed", videoSrc("https://youtu.be/abc123").src, "https://www.youtube.com/embed/abc123");
check("a vimeo url becomes an embed", videoSrc("https://vimeo.com/12345").src, "https://player.vimeo.com/video/12345");
check("an embed is an iframe", videoSrc("https://youtu.be/abc123").kind, "iframe");
check("anything else is a file", videoSrc("https://cdn.example.com/a.mp4").kind, "file");
check("no url is null", videoSrc(""), null);

/* --- HTML export ------------------------------------------------------------------ */

const html = toHtml(article);
check("a heading exports with its tag", html.includes("<h1>Title</h1>"), true);
check("a divider exports as hr", html.includes("<hr>"), true);
check("a bullet is wrapped in a ul", html.includes("<ul>") && html.includes("<li>six</li>"), true);

// Five bullets should export as one list, not five.
const listed = toHtml([
  block("bullet", { html: "a" }),
  block("bullet", { html: "b" }),
  block("bullet", { html: "c" }),
]);
check("consecutive bullets fold into one list", (listed.match(/<ul>/g) || []).length, 1);
check("each bullet is an item", (listed.match(/<li>/g) || []).length, 3);

const mixed = toHtml([
  block("bullet", { html: "a" }),
  block("numbered", { html: "b" }),
]);
check("a change of list kind opens a new list", mixed.includes("</ul>") && mixed.includes("<ol>"), true);

const interrupted = toHtml([block("bullet", { html: "a" }), block("p", { html: "x" }), block("bullet", { html: "b" })]);
check("a paragraph closes the list", (interrupted.match(/<ul>/g) || []).length, 2);

check("a checked to-do exports checked", toHtml([block("todo", { html: "x", checked: true })]).includes("checked"), true);
check("an unchecked to-do does not", toHtml([block("todo", { html: "x" })]).includes("checked"), false);

/**
 * The escaping cases. These values are whatever an author typed or pasted.
 */
const nasty = toHtml([
  block("image", { src: 'a.png" onerror="alert(1)', caption: 'say "hi" & bye' }),
  block("table", { columns: [{ key: "k", label: '<script>' }], rows: [{ k: '</td><script>' }] }),
  block("kpis", { kpis: [{ label: '<b>x</b>', value: '"y"' }] }),
]);

check("a quote in a src is escaped", nasty.includes('onerror="'), false);
check("the src still round-trips its text", nasty.includes("&quot;"), true);
check("a script in a column label is escaped", nasty.includes("<script>"), false);
check("a script in a cell is escaped", nasty.includes("</td><script>"), false);
check("a kpi label is escaped", nasty.includes("<b>x</b>"), false);

/**
 * Code is source, not markup. Stripping tags from it deletes the very thing
 * the block exists to show: a snippet of HTML came out as its own text
 * content, with the tags gone.
 */
check("code keeps the tags it shows", toHtml([block("code", { html: "&lt;div&gt;hi&lt;/div&gt;" })]).includes("&lt;div&gt;hi&lt;/div&gt;"), true);
check("code is escaped, not executed", toHtml([block("code", { html: "&lt;script&gt;" })]).includes("<script>"), false);
check("markdown code keeps its tags", toMarkdown([block("code", { html: "&lt;div&gt;" })]).includes("<div>"), true);
check("a code newline survives", toMarkdown([block("code", { html: "a<br>b" })]).includes(String.fromCharCode(97, 10, 98)), true);
check("code is wrapped in pre", toHtml([block("code", { html: "x" })]).includes("<pre><code>"), true);

check("a signature exports its people", toHtml([block("signature", { people: [{ name: "Marie" }] })]).includes("Marie"), true);
check("an unsigned person is pending", toHtml([block("signature", { people: [{ name: "M" }] })]).includes("pending"), true);
check("a signed person shows a time", toHtml([block("signature", { people: [{ name: "M", signedAt: "2026-08-31" }] })]).includes("<time"), true);

check("a video url is embedded", toHtml([block("video", { src: "https://youtu.be/abc123" })]).includes("youtube.com/embed"), true);
check("a file video uses the video tag", toHtml([block("video", { src: "/a.mp4" })]).includes("<video"), true);

check("an empty document exports nothing", toHtml([]), "");

/* --- Markdown export ---------------------------------------------------------------- */

check("a heading becomes hashes", toMarkdown([block("h2", { html: "Two" })]), "## Two");
check("bold becomes asterisks", toMarkdown([block("p", { html: "<b>x</b>" })]), "**x**");
check("italic becomes one asterisk", toMarkdown([block("p", { html: "<i>x</i>" })]), "*x*");
check("a link becomes bracket-paren", toMarkdown([block("p", { html: '<a href="/a">x</a>' })]), "[x](/a)");
check("code becomes backticks", toMarkdown([block("p", { html: "<code>x</code>" })]), "`x`");
check("an entity decodes", toMarkdown([block("p", { html: "a &amp; b" })]), "a & b");

check("a to-do exports its state", toMarkdown([block("todo", { html: "x", checked: true })]), "- [x] x");
check("an open to-do exports a space", toMarkdown([block("todo", { html: "x" })]), "- [ ] x");

/**
 * The counter case. Two numbered sections separated by a heading is what a
 * structured document looks like, and the second list has to start at 1.
 */
const twoLists = toMarkdown([
  block("numbered", { html: "a" }),
  block("numbered", { html: "b" }),
  block("h2", { html: "Next" }),
  block("numbered", { html: "c" }),
  block("numbered", { html: "d" }),
]);
check("the first list starts at one", twoLists.startsWith("1. a"), true);
check("it counts up", twoLists.includes("2. b"), true);
check("the second list restarts at one", twoLists.includes("1. c"), true);
check("and counts up again", twoLists.includes("2. d"), true);
check("it never reaches three", twoLists.includes("3."), false);

// A paragraph between two numbered blocks resets too.
const brokenByText = toMarkdown([
  block("numbered", { html: "a" }),
  block("p", { html: "aside" }),
  block("numbered", { html: "b" }),
]);
check("a paragraph resets the counter", brokenByText.includes("1. b"), true);

check("a code fence carries its language", toMarkdown([block("code", { html: "x", lang: "sql" })]).startsWith("```sql"), true);
check("no language leaves the fence bare", toMarkdown([block("code", { html: "x" })]).startsWith("```\n"), true);

const table = toMarkdown([block("table", { columns: [{ key: "a", label: "A" }, { key: "b" }], rows: [{ a: 1, b: 2 }] })]);
check("a table has a header row", table.includes("| A | b |"), true);
check("a table has a separator row", table.includes("| --- | --- |"), true);
check("a table has its data", table.includes("| 1 | 2 |"), true);

check("blocks are separated by a blank line", toMarkdown([block("p", { html: "a" }), block("p", { html: "b" })]), "a\n\nb");

/* --- editing --------------------------------------------------------------------------- */

const three = [block("p", { html: "a" }), block("p", { html: "b" }), block("p", { html: "c" })];
three[0].id = "one";
three[1].id = "two";
three[2].id = "three";

check("a block moves up", moveBlock(three, "two", -1)[0].id, "two");
check("a block moves down", moveBlock(three, "two", 1)[2].id, "two");
// Past the end is a no-op, not a crash or a wrap.
check("the first cannot move up", moveBlock(three, "one", -1)[0].id, "one");
check("the last cannot move down", moveBlock(three, "three", 1)[2].id, "three");
check("an unknown id is a no-op", moveBlock(three, "nope", 1).length, 3);
check("moving does not mutate", three[1].id, "two");

check("a block is removed", removeBlock(three, "two").length, 2);
// A document with no block has nowhere to type.
check("the last block is replaced, not removed", removeBlock([three[0]], "one").length, 1);
check("the replacement is a paragraph", removeBlock([three[0]], "one")[0].type, "p");

const duplicated = duplicateBlock(three, "two");
check("a duplicate is inserted", duplicated.length, 4);
check("it sits after the original", duplicated[2].html, "b");
// Sharing an id would make React reuse one node for both.
check("it has its own id", duplicated[2].id === "two", false);

/* --- shortcuts -------------------------------------------------------------------------- */

check("hash space makes a heading", shortcutFor("# "), "h1");
check("two hashes make an h2", shortcutFor("## "), "h2");
check("a dash makes a bullet", shortcutFor("- "), "bullet");
check("an asterisk makes a bullet", shortcutFor("* "), "bullet");
check("one dot makes a numbered list", shortcutFor("1. "), "numbered");
check("brackets make a to-do", shortcutFor("[] "), "todo");
check("a chevron makes a quote", shortcutFor("> "), "quote");
check("three backticks make code", shortcutFor("```"), "code");
check("three dashes make a divider", shortcutFor("---"), "divider");
check("ordinary text is not a shortcut", shortcutFor("hello"), null);
check("a hash with no space is not one", shortcutFor("#"), null);

/* --- report ------------------------------------------------------------------------------ */

let failed = 0;
for (const [name, actual, expected] of cases) {
  const ok = Object.is(actual, expected);
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${name.padEnd(50)} -> ${JSON.stringify(actual)}${
      ok ? "" : `   expected ${JSON.stringify(expected)}`
    }`,
  );
}

console.log(`\n${cases.length - failed}/${cases.length} document checks passed`);
if (failed) process.exit(1);
