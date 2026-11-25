/* Small behaviours shared by every page. */
(function () {
  // If a page-to-page fade gets interrupted, ignore it quietly.
  window.addEventListener('pagereveal', function (e) {
    if (e.viewTransition) {
      e.viewTransition.ready.catch(function () {});
      e.viewTransition.finished.catch(function () {});
    }
  });
  window.addEventListener('pageswap', function (e) {
    if (e.viewTransition) {
      e.viewTransition.ready.catch(function () {});
      e.viewTransition.finished.catch(function () {});
    }
  });

  // Typeset LaTeX. The build leaves math as \\(...\\) or \\[...\\] inside .arithmatex
  // elements, and only pages with math load KaTeX.
  function typeset() {
    if (!window.katex) return;
    Array.prototype.forEach.call(document.querySelectorAll('.arithmatex'), function (el) {
      var tex = el.textContent.trim();
      var display = tex.slice(0, 2) === '\\[';
      tex = tex.slice(2, -2);
      try { window.katex.render(tex, el, { displayMode: display, throwOnError: false }); } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', typeset);
  else typeset();

  // "Copy address" buttons: copy the value in data-copy and say so.
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (button) {
    var status = button.parentNode.querySelector('[data-copy-status]');
    function say(text) {
      if (!status) return;
      status.textContent = text;
      setTimeout(function () { status.textContent = ''; }, 2500);
    }
    button.addEventListener('click', function () {
      try {
        navigator.clipboard.writeText(button.getAttribute('data-copy')).then(
          function () { say('Copied'); },
          function () { say("Couldn't copy. Select the address instead."); }
        );
      } catch (e) { say("Couldn't copy. Select the address instead."); }
    });
  });
})();
