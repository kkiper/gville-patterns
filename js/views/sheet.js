// Pull-up panel shared by all screens.
const el = document.getElementById('sheet');
const body = el.querySelector('.sheet-body');
el.querySelector('.sheet-grip').addEventListener('click', close);

export function open(html) {
  body.innerHTML = html;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  el.scrollTop = 0;
  return body;
}
export function close() {
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
}
