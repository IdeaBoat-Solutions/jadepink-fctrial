(() => {
  const el = document.querySelector("select[aria-label='Assign FC']");
  if (!el) return 'NO-EL';
  const native = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  native.call(el, '6c42a618-bd28-4f54-b5e2-3c43d2330422');
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'DISPATCHED value=' + el.value;
})()
