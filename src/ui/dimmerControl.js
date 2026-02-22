export function wireDimmerControl({ layerManager, sliderEl, valueEl }) {
  const updateDimmer = (value) => {
    const parsed = Number(value);
    const opacity = layerManager.setBaseImageryDim(parsed);
    valueEl.textContent = `${parsed}%`;
    return opacity;
  };

  sliderEl.addEventListener('input', (e) => updateDimmer(e.target.value));
  updateDimmer(sliderEl.value);

  return { updateDimmer };
}
