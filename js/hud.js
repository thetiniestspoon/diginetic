export function mountHud(el) {
  return function render(state) {
    el.innerHTML =
      `<span>tick ${state.tick}</span>` +
      `<span>pop ${state.population}</span>` +
      `<span>gen ${state.generation}</span>` +
      `<span>div ${state.diversity.toFixed(2)}</span>`;
  };
}
