/* Поиск по сайту и две мелочи вокруг текста: кнопка «Скопировать» у
   блоков команд и значок ссылки у заголовков.
 *
 * Поиск идёт по индексу, уже загруженному в браузер: у сайта
 * документации, как и у продукта, сети может не быть. Русские слова
 * сравниваются по основе — окончание отрезается тем же грубым приёмом,
 * каким это делает L0 без модели: «раздать» находит «раздача».
 */

(function () {
  "use strict";

  var base = document.body.getAttribute("data-base") || "";
  var input = document.getElementById("q");
  var found = document.getElementById("found");
  var index = null;
  var picked = -1;

  /* ── Основа слова ───────────────────────────────────────────────── */

  var endings = [
    "ениями", "ениям", "ением", "ениях", "ения", "ение", "ений",
    "ами", "ями", "ого", "ему", "ому", "ыми", "ими", "ая", "яя", "ое", "ее",
    "ыи", "ии", "ей", "ей", "ов", "ев", "ам", "ям", "ах", "ях", "ою", "ею",
    "ть", "ся", "ий", "ый", "ой", "ые", "ие", "ла", "ло", "ли", "ет", "ут", "ют",
    "а", "я", "о", "е", "ы", "и", "у", "ю", "ь", "й"
  ];

  function stem(word) {
    word = word.toLowerCase().replace(/ё/g, "е");
    if (word.length < 5) return word;
    for (var i = 0; i < endings.length; i++) {
      var e = endings[i];
      if (word.length - e.length >= 4 && word.slice(-e.length) === e) {
        return word.slice(0, word.length - e.length);
      }
    }
    return word;
  }

  function words(text) {
    return (text.toLowerCase().replace(/ё/g, "е").match(/[a-zа-я0-9-]{2,}/g) || []);
  }

  /* ── Поиск ──────────────────────────────────────────────────────── */

  function load(then) {
    if (index) { then(); return; }
    var req = new XMLHttpRequest();
    req.open("GET", base + "assets/search-index.json", true);
    req.onload = function () {
      try { index = JSON.parse(req.responseText); } catch (e) { index = []; }
      then();
    };
    req.onerror = function () { index = []; then(); };
    req.send();
  }

  function score(entry, query) {
    var title = entry.title.toLowerCase();
    var hay = words(entry.title + " " + entry.section + " " + entry.text).map(stem);
    var total = 0;
    for (var i = 0; i < query.length; i++) {
      var q = query[i];
      var hits = 0;
      for (var j = 0; j < hay.length; j++) {
        if (hay[j] === q || hay[j].indexOf(q) === 0) hits++;
      }
      if (!hits) return 0;
      total += Math.min(hits, 8);
      if (title.indexOf(q) >= 0) total += 12;
    }
    return total;
  }

  function search(text) {
    var query = words(text).map(stem);
    if (!query.length) return [];
    var out = [];
    for (var i = 0; i < index.length; i++) {
      var s = score(index[i], query);
      if (s > 0) out.push({ entry: index[i], score: s });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 8);
  }

  function show(results) {
    found.innerHTML = "";
    picked = -1;
    if (!results.length) {
      found.hidden = true;
      input.setAttribute("aria-expanded", "false");
      return;
    }
    for (var i = 0; i < results.length; i++) {
      var e = results[i].entry;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = base + e.url;
      a.textContent = e.title;
      if (e.section) {
        var small = document.createElement("small");
        small.textContent = e.section;
        a.appendChild(small);
      }
      li.appendChild(a);
      found.appendChild(li);
    }
    found.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function move(step) {
    var items = found.querySelectorAll("li");
    if (!items.length) return;
    if (picked >= 0) items[picked].className = "";
    picked = (picked + step + items.length) % items.length;
    items[picked].className = "on";
    items[picked].querySelector("a").focus();
  }

  if (input) {
    input.addEventListener("input", function () {
      var text = input.value;
      if (text.trim().length < 2) { show([]); return; }
      load(function () { show(search(text)); });
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Escape") { show([]); input.blur(); }
      else if (e.key === "Enter") {
        var first = found.querySelector("a");
        if (first) { e.preventDefault(); location.href = first.href; }
      }
    });

    /* Косая черта ставит курсор в поиск — как Mod+K в самом Джуне. */
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== input &&
          !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });

    document.addEventListener("click", function (e) {
      if (!found.contains(e.target) && e.target !== input) show([]);
    });
  }

  /* ── Кнопка «Скопировать» ───────────────────────────────────────── */

  var blocks = document.querySelectorAll(".text pre");
  for (var i = 0; i < blocks.length; i++) {
    (function (pre) {
      var button = document.createElement("button");
      button.className = "copy";
      button.type = "button";
      button.textContent = "Скопировать";
      button.addEventListener("click", function () {
        var text = pre.querySelector("code") ? pre.querySelector("code").textContent : pre.textContent;
        navigator.clipboard.writeText(text).then(function () {
          button.textContent = "Скопировано";
          setTimeout(function () { button.textContent = "Скопировать"; }, 1500);
        });
      });
      pre.appendChild(button);
    })(blocks[i]);
  }

  /* ── Ссылка на заголовок ────────────────────────────────────────── */

  var heads = document.querySelectorAll(".text h2[id], .text h3[id]");
  for (var k = 0; k < heads.length; k++) {
    var link = document.createElement("a");
    link.className = "anchor";
    link.href = "#" + heads[k].id;
    link.textContent = "¶";
    link.setAttribute("aria-label", "Ссылка на этот раздел");
    heads[k].appendChild(link);
  }
})();
