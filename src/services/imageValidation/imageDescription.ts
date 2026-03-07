import type { PerceptionFeatures, QualitySignals } from './types';

export const buildImageDescription = (features: PerceptionFeatures, quality: QualitySignals): string => {
  if (features.personVisible && !features.buildingExterior && !features.commercialInterior && !features.productsVisible) {
    return 'Se observa una persona en primer plano en un entorno interior. No se detecta contexto comercial claro.';
  }
  if (features.productsVisible) {
    return 'Se observan productos o mercancia visibles con apariencia de inventario del negocio.';
  }
  if (features.commercialInterior) {
    return 'Se aprecia un espacio interior comercial con elementos de atencion o circulacion.';
  }
  if (features.buildingExterior) {
    return 'Se observa la parte exterior de un local comercial con elementos visibles de fachada.';
  }
  if (quality.brightness < 28 || quality.blurry) {
    return 'La imagen es poco clara o con visibilidad limitada, y no permite identificar con certeza el contexto del negocio.';
  }
  return 'No se identifican elementos visuales suficientes para clasificar la imagen como fachada, interior o inventario.';
};
