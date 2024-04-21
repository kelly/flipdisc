import AlfaZetaPanel from "./alfazeta.js";
import HanoverPanel from "./hanover.js";

function panelForType(type) {
  switch (type.toLowerCase()) {
    case 'alfazeta':
      return AlfaZetaPanel
    case 'hanover':
      return HanoverPanel
    default:
      throw new Error('Invalid panel type')
  }
}

export { panelForType, AlfaZetaPanel }