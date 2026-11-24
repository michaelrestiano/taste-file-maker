/* Taste file maker.
   Five prompts in, a taste.md out. Everything runs in this tab: no model, no keys,
   no analytics, nothing sent anywhere. Answers sit in sessionStorage so an accidental
   reload does not lose them; closing the tab clears them. */
(function () {
  "use strict";

  // ---------- The five prompts ----------
  var PROMPTS = [
    {
      key: "who",
      title: "Who are you, and what do you make?",
      hint: "Role, team, product, and who it is for. Two or three lines is plenty.",
      exampleLabel: "About you",
      example: true, link: false, why: false, feel: true,
      placeholder: "I'm a product designer at a small fintech. We make a budgeting app for freelancers who hate spreadsheets."
    },
    {
      key: "goodWriting",
      title: "Writing you think is good.",
      hint: "Paste a sentence or a paragraph, or link to it. Then say why it works for you.",
      exampleLabel: "The example (paste it, or describe it)",
      whyLabel: "Why it works for you",
      example: true, link: true, why: true, feel: false,
      placeholder: "\"Your money, sorted by Friday.\"",
      whyPlaceholder: "I like that the headline says what the product does in six words."
    },
    {
      key: "badWriting",
      title: "Writing you think is bad.",
      hint: "Paste it or link it. Then say why it fails for you.",
      exampleLabel: "The example (paste it, or describe it)",
      whyLabel: "Why it fails for you",
      example: true, link: true, why: true, feel: false,
      placeholder: "\"Unlock the power of next-generation financial wellness.\"",
      whyPlaceholder: "It hides what the product does behind big words."
    },
    {
      key: "goodDesign",
      title: "Design you think is good.",
      hint: "Link to it, name a screenshot, or describe it. Then say why it works for you.",
      exampleLabel: "The example (link, screenshot name, or description)",
      whyLabel: "Why it works for you",
      example: true, link: true, why: true, feel: false,
      placeholder: "The checkout page on a train-ticket site: one column, one button.",
      whyPlaceholder: "I like that the main action is the only thing in colour."
    },
    {
      key: "badDesign",
      title: "Design you think is bad.",
      hint: "Link to it, name a screenshot, or describe it. Then say why it fails for you.",
      exampleLabel: "The example (link, screenshot name, or description)",
      whyLabel: "Why it fails for you",
      example: true, link: true, why: true, feel: false,
      placeholder: "A dashboard with twelve cards of the same size and no headline number.",
      whyPlaceholder: "Everything is the same weight, so nothing is important."
    }
  ];

  var RULE_SOURCES = [
    { key: "goodWriting", heading: "Writing you think is good", polarity: "do" },
    { key: "badWriting", heading: "Writing you think is bad", polarity: "dont" },
    { key: "goodDesign", heading: "Design you think is good", polarity: "do" },
    { key: "badDesign", heading: "Design you think is bad", polarity: "dont" }
  ];

  // Screen order: intro, p1..p5, rules, preview, place.
  var STEPS = ["intro", "p0", "p1", "p2", "p3", "p4", "rules", "preview", "place"];
  var STORE_KEY = "taste-file-maker";

  // ---------- State ----------
  var state = load() || blank();

  function blank() {
    return {
      step: 0,
      answers: { who: { example: "", feel: "" } },
      rules: {},      // key -> { text, polarity, edited }
      ruleSource: {}  // key -> the "why" text the rule was derived from
    };
  }
  function load() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || typeof s.step !== "number" || !s.answers) return null;
      return s;
    } catch (e) { return null; }
  }
  function save() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: fine */ }
  }
  function answer(key) {
    if (!state.answers[key]) state.answers[key] = { example: "", link: "", why: "" };
    return state.answers[key];
  }

  // ---------- Rule derivation (deterministic string rules) ----------
  // Each "why" becomes one imperative line. The participant's wording is kept; only the
  // frame changes: a trigger phrase is stripped, a third-person verb loses its -s, a
  // negated reason flips to the other list. Everything else stays as typed.

  var TRIGGERS = [
    /^(i (really |just |also )?(like|love|appreciate|enjoy|admire) (that|how|the way( that)?|when|because)\s+)/i,
    /^(i (really |just |also )?(hate|dislike|can't stand|cannot stand) (that|how|the way( that)?|when|because)\s+)/i,
    /^(it (works|fails|is good|is bad|succeeds|falls down|doesn't work|does not work)( for me)? because\s+)/i,
    /^(it'?s (good|bad|great|awful|terrible|wrong|right) because\s+)/i,
    /^(the (problem|issue|trouble|reason) (is|was) (that\s+)?)/i,
    /^(what (i|we) (don't|do not|didn't) like (is|was) (that\s+)?)/i,
    /^(what (i|we) (like|love) (is|was) (that\s+)?)/i,
    /^(i (think|feel|find) (that\s+)?)/i,
    /^(because\s+)/i,
    /^(it'?s that\s+)/i
  ];

  var IRREGULAR = { is: "be", are: "be", has: "have", does: "do", goes: "go", was: "be", were: "be" };
  var LINKING = { is: 1, are: 1, was: 1, were: 1, feels: 1, looks: 1, sounds: 1, seems: 1, reads: 1 };

  function baseVerb(v) {
    var lower = v.toLowerCase();
    if (IRREGULAR[lower]) return IRREGULAR[lower];
    if (/(ss|us|is)$/.test(lower)) return lower;             // "discuss", "focus"
    if (/ies$/.test(lower)) return lower.replace(/ies$/, "y"); // "tries" -> "try"
    if (/(sh|ch|x|z|o|s)es$/.test(lower)) return lower.replace(/es$/, ""); // "pushes" -> "push"
    if (/s$/.test(lower)) return lower.replace(/s$/, "");
    return lower;
  }

  function firstSentence(text) {
    var t = (text || "").replace(/\s+/g, " ").trim();
    var m = t.match(/^(.+?[.!?])(\s|$)/);
    return (m ? m[1] : t).replace(/[.!?]+$/, "").trim();
  }

  function lowerFirst(s) {
    if (!s) return s;
    if (/^I\b/.test(s)) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  // Returns { text, polarity }.
  function deriveRule(why, polarity) {
    var s = firstSentence(why);
    if (!s) return { text: "", polarity: polarity };

    for (var i = 0; i < TRIGGERS.length; i++) s = s.replace(TRIGGERS[i], "");
    s = s.trim();

    // A negated reason flips the list: "I like that it doesn't shout" -> Don't: shout.
    var neg = s.match(/^(it|they|there)\s+(doesn't|does not|don't|do not|never|isn't|is not|aren't|are not)\s+(.*)$/i);
    if (neg) {
      var rest = neg[3];
      if (/^(isn't|is not|aren't|are not)$/i.test(neg[2])) rest = "be " + rest;
      return { text: lowerFirst(rest), polarity: polarity === "do" ? "dont" : "do" };
    }
    // "no hierarchy at all" (bad) -> Do: have hierarchy. "too much text" (bad) -> Don't: use too much text.
    var noNoun = s.match(/^(no|not enough|hardly any)\s+(.*?)(\s+at all)?$/i);
    if (noNoun && polarity === "dont") {
      var want = /^no$/i.test(noNoun[1]) ? "have " : "have enough ";
      return { text: want + lowerFirst(noNoun[2]), polarity: "do" };
    }
    var tooNoun = s.match(/^too (much|many|little|few)\s+(.*)$/i);
    if (tooNoun && polarity === "dont") {
      return { text: "use " + lowerFirst(s), polarity: "dont" };
    }
    // "everything is the same weight" -> make everything the same weight
    var every = s.match(/^(everything|everyone|all of it|every element|every screen)\s+(is|are|looks|feels|seems)\s+(.*)$/i);
    if (every) return { text: "make " + every[1].toLowerCase() + " " + every[3], polarity: polarity };

    // "it says what the product does" -> "say what the product does"
    var pron = s.match(/^(it|they|this|that)\s+([a-z']+)\s+(.*)$/i);
    if (pron) {
      var v = pron[2], restP = pron[3];
      if (LINKING[v.toLowerCase()]) return { text: lowerFirst(restP), polarity: polarity };
      if (/^(can|could|lets|let|makes|make|helps|help|gives|give|tells|tell|shows|show)$/i.test(v) && /^(me|you|us)\b/i.test(restP)) {
        return { text: baseVerb(v) + " " + lowerFirst(restP), polarity: polarity };
      }
      return { text: baseVerb(v) + " " + lowerFirst(restP), polarity: polarity };
    }

    // "the headline says what the product does" -> "say what the product does in the headline"
    // Singular: "the headline says ..."; plural: "the buttons look like links".
    // Try a 1-, 2- or 3-word subject after the determiner; take the first split whose next
    // word looks like a verb.
    var det = s.match(/^(the|every|each|its|their|all the|all of the)\s+(.*)$/i);
    if (det) {
      var words = det[2].split(" ");
      for (var n = 1; n <= 3 && n < words.length - 1; n++) {
        var verb = words[n].toLowerCase();
        var tail = words.slice(n + 1).join(" ");
        var subject = det[1].toLowerCase() + " " + words.slice(0, n).join(" ");
        var plural = /s$/i.test(words[n - 1]) && !/s$/.test(verb);
        var known = /^(is|was|are|were|has|have|look|feel|sound|seem|read|say|tell|show|use|put|keep|make|give|let|hide|get|do|go|all)$/.test(verb);
        if (verb === "all") { subject += " all"; continue; }
        if (!/s$/.test(verb) && !known) continue;
        if (/^(a|an|the|this|that|these|those|us|is|as|its|yes|plus|always|sometimes|less|unless|across|various|previous|obvious|serious|famous|nervous|anonymous)$/.test(verb) && !/^(is)$/.test(verb)) continue;
        if (/^(is|was|are|were)$/.test(verb)) return { text: "keep " + subject + " " + tail, polarity: polarity };
        if (/^(has|have)$/.test(verb)) return { text: "give " + subject + " " + tail, polarity: polarity };
        if (LINKING[verb] || /^(look|feel|sound|seem|read)$/.test(verb)) return { text: "make " + subject + " " + baseVerb(verb) + " " + tail, polarity: polarity };
        return { text: (plural ? verb : baseVerb(verb)) + " " + tail + " in " + subject, polarity: polarity };
      }
    }

    // "I can find the price in one glance" -> "make sure I can find the price in one glance"
    if (/^(i|you|we) (can|could)\b/i.test(s)) {
      return { text: "make sure " + s.replace(/^(you|we)\b/i, "I"), polarity: polarity };
    }
    // "there is one clear action" -> "have one clear action"
    var there = s.match(/^there (is|are|was|were)\s+(.*)$/i);
    if (there) return { text: "have " + there[2], polarity: polarity };

    // A bare noun phrase: "short sentences" -> Do: use short sentences.
    if (!/^(the|a|an|it|they|this|that|every|each|my|our|your)\b/i.test(s) && !/\b(is|are|was|were|has|have|does|do|says|feels|looks|look|feel|makes|make|uses|use|puts|keeps|shows|tells|gives|lets)\b/i.test(s) && s.split(" ").length <= 5) {
      return { text: "use " + lowerFirst(s), polarity: polarity };
    }

    return { text: lowerFirst(s), polarity: polarity };
  }

  function rebuildRules() {
    RULE_SOURCES.forEach(function (src) {
      var why = (answer(src.key).why || "").trim();
      var existing = state.rules[src.key];
      // Keep a hand-edited rule unless its source answer changed.
      if (existing && existing.edited && state.ruleSource[src.key] === why) return;
      var r = deriveRule(why, src.polarity);
      state.rules[src.key] = { text: r.text, polarity: r.polarity, edited: false };
      state.ruleSource[src.key] = why;
    });
  }

  // ---------- The file ----------
  function exampleBlock(key) {
    var a = answer(key);
    var lines = [];
    var ex = (a.example || "").trim();
    var link = (a.link || "").trim();
    if (ex) lines.push(ex);
    if (link) lines.push((ex ? "Link: " : "") + link);
    if (!lines.length) lines.push("(no example given)");
    return lines.join("\n");
  }

  function buildFile() {
    rebuildRules(); // keeps hand-edited rules; fills any that were never derived
    var who = (answer("who").example || "").trim() || "(not filled in)";
    var feel = (answer("who").feel || "").trim().replace(/[.\s]+$/, "");
    var description = "How I judge writing and design. Read before making anything I will put in front of people.";
    if (feel) description += " My work should feel " + feel + ".";

    var dos = [], donts = [];
    RULE_SOURCES.forEach(function (src) {
      var r = state.rules[src.key];
      if (!r || !r.text.trim()) return;
      (r.polarity === "do" ? dos : donts).push("- " + r.text.trim().replace(/[.]+$/, ""));
    });
    if (!dos.length) dos.push("- (none yet)");
    if (!donts.length) donts.push("- (none yet)");

    return [
      "---",
      "name: my-taste",
      "description: " + description,
      "---",
      "",
      "# Who I am and what I make",
      who,
      "",
      "# Writing I think is good",
      exampleBlock("goodWriting"),
      "Why it works for me: " + (answer("goodWriting").why || "").trim(),
      "",
      "# Writing I think is bad",
      exampleBlock("badWriting"),
      "Why it fails for me: " + (answer("badWriting").why || "").trim(),
      "",
      "# Design I think is good",
      exampleBlock("goodDesign"),
      "Why it works for me: " + (answer("goodDesign").why || "").trim(),
      "",
      "# Design I think is bad",
      exampleBlock("badDesign"),
      "Why it fails for me: " + (answer("badDesign").why || "").trim(),
      "",
      "# Rules (derived from the examples above)",
      "Do:",
      dos.join("\n"),
      "Don't:",
      donts.join("\n"),
      "",
      "# When you make a prototype for me",
      "1. Read the rules before the first draft, not after.",
      "2. Use real example content, never lorem ipsum or \"Lorem Title\".",
      "3. Make the main action obvious; one idea per screen.",
      "4. If a rule and the brief conflict, follow the brief and tell me which rule you broke.",
      "5. End with the three decisions you made that my rules did not cover, so I can add them.",
      ""
    ].join("\n");
  }

  function download() {
    var text = buildFile();
    var blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "taste.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function copy(statusEl) {
    var text = buildFile();
    function done(ok) {
      if (!statusEl) return;
      statusEl.textContent = ok ? "Copied." : "Copy failed. Select the text below and copy it.";
      setTimeout(function () { statusEl.textContent = ""; }, 3000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      done(ok);
    }
  }

  // ---------- Rendering ----------
  var host = document.getElementById("main");
  var progressEl = document.getElementById("progress");

  function clone(id) {
    return document.getElementById(id).content.firstElementChild.cloneNode(true);
  }
  function set(root, field, text) {
    var el = root.querySelector('[data-field="' + field + '"]');
    if (el) el.textContent = text;
    return el;
  }

  function render() {
    var step = STEPS[state.step];
    host.innerHTML = "";
    progressEl.textContent = "";
    var screen;
    if (step === "intro") screen = renderIntro();
    else if (/^p\d$/.test(step)) screen = renderPrompt(parseInt(step.slice(1), 10));
    else if (step === "rules") screen = renderRules();
    else if (step === "preview") screen = renderPreview();
    else screen = renderPlace();
    host.appendChild(screen);
    window.scrollTo(0, 0);
    var first = screen.querySelector("h1");
    if (first) { first.setAttribute("tabindex", "-1"); first.focus({ preventScroll: true }); }
    save();
  }

  function go(delta) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, state.step + delta));
    render();
  }

  function renderIntro() {
    var el = clone("tpl-intro");
    el.querySelector('[data-action="start"]').addEventListener("click", function () { go(1); });
    return el;
  }

  function renderPrompt(i) {
    var p = PROMPTS[i];
    var a = answer(p.key);
    var el = clone("tpl-prompt");
    progressEl.textContent = (i + 1) + " of 5";
    set(el, "title", p.title);
    set(el, "hint", p.hint);
    set(el, "exampleLabel", p.exampleLabel);
    if (p.whyLabel) set(el, "whyLabel", p.whyLabel);

    var exampleEl = el.querySelector('[data-input="example"]');
    var linkEl = el.querySelector('[data-input="link"]');
    var whyEl = el.querySelector('[data-input="why"]');
    var feelEl = el.querySelector('[data-input="feel"]');

    // Give each control an id so its label points at it.
    [["example", exampleEl], ["link", linkEl], ["why", whyEl], ["feel", feelEl]].forEach(function (pair) {
      var id = "f-" + p.key + "-" + pair[0];
      pair[1].id = id;
      var lab = pair[1].closest(".field").querySelector("label");
      if (lab) lab.setAttribute("for", id);
    });

    exampleEl.placeholder = p.placeholder || "";
    exampleEl.value = a.example || "";
    linkEl.value = a.link || "";
    whyEl.value = a.why || "";
    whyEl.placeholder = p.whyPlaceholder || "";
    feelEl.value = a.feel || "";

    el.querySelector('[data-slot="link"]').hidden = !p.link;
    el.querySelector('[data-slot="why"]').hidden = !p.why;
    el.querySelector('[data-slot="feel"]').hidden = !p.feel;
    if (!p.why) { exampleEl.required = true; exampleEl.setAttribute("aria-required", "true"); }

    function collect() {
      a.example = exampleEl.value;
      a.link = linkEl.value;
      a.why = whyEl.value;
      a.feel = feelEl.value;
      save();
    }
    ["input", "change"].forEach(function (ev) { el.addEventListener(ev, collect); });

    el.querySelector('[data-action="back"]').addEventListener("click", function () { collect(); go(-1); });
    el.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      collect();
      var required = p.why ? whyEl : exampleEl;
      var field = required.closest(".field");
      if (!required.value.trim()) {
        field.classList.add("invalid");
        var err = el.querySelector('[data-field="whyError"]');
        if (p.why) {
          err.hidden = false;
          err.textContent = "The why is the part that becomes a rule. One sentence is enough.";
        }
        required.focus();
        return;
      }
      field.classList.remove("invalid");
      if (i === PROMPTS.length - 1) rebuildRules();
      go(1);
    });
    return el;
  }

  function renderRules() {
    rebuildRules();
    var el = clone("tpl-rules");
    var grid = el.querySelector('[data-slot="rules"]');
    RULE_SOURCES.forEach(function (src) {
      var r = state.rules[src.key];
      var row = clone("tpl-rule-row");
      set(row, "heading", src.heading);
      set(row, "why", (answer(src.key).why || "").trim());
      var lab = row.querySelector('[data-field="ruleLabel"]');
      var ta = row.querySelector('[data-input="rule"]');
      ta.id = "rule-" + src.key;
      lab.setAttribute("for", ta.id);
      function paint() {
        lab.textContent = r.polarity === "do" ? "Do" : "Don't";
        lab.className = "label " + (r.polarity === "do" ? "do" : "dont");
      }
      paint();
      ta.value = r.text;
      ta.addEventListener("input", function () {
        r.text = ta.value;
        r.edited = true;
        save();
      });
      grid.appendChild(row);
    });
    el.querySelector('[data-action="back"]').addEventListener("click", function () { go(-1); });
    el.querySelector('[data-action="next"]').addEventListener("click", function () { go(1); });
    return el;
  }

  function renderPreview() {
    var el = clone("tpl-preview");
    set(el, "file", buildFile());
    var status = el.querySelector('[data-field="status"]');
    el.querySelector('[data-action="download"]').addEventListener("click", function () {
      download();
      status.textContent = "Downloading taste.md";
      setTimeout(function () { status.textContent = ""; }, 3000);
    });
    el.querySelector('[data-action="copy"]').addEventListener("click", function () { copy(status); });
    el.querySelector('[data-action="back"]').addEventListener("click", function () { go(-1); });
    el.querySelector('[data-action="next"]').addEventListener("click", function () { go(1); });
    return el;
  }

  function renderPlace() {
    var el = clone("tpl-place");
    el.querySelector('[data-action="back"]').addEventListener("click", function () { go(-1); });
    el.querySelector('[data-action="download"]').addEventListener("click", download);
    el.querySelector('[data-action="restart"]').addEventListener("click", function () {
      if (!window.confirm("Start over? This clears your five answers.")) return;
      state = blank();
      try { sessionStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      render();
    });
    return el;
  }

  // Expose the pure parts for a quick check in the console; nothing else is global.
  window.tasteFileMaker = { deriveRule: deriveRule, buildFile: buildFile };

  render();
})();
