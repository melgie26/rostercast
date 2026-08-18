import { classifySmsText } from "./encoding.js";

export function calculateSms(text) {
  const classification = classifySmsText(text);
  const singleCapacity = classification.encoding === "GSM-7" ? 160 : 70;
  const multipartCapacity = classification.encoding === "GSM-7" ? 153 : 67;
  const segments = classification.encodedUnits === 0 ? 0 : classification.encodedUnits <= singleCapacity ? 1 : Math.ceil(classification.encodedUnits / multipartCapacity);
  const capacity = segments <= 1 ? singleCapacity : segments * multipartCapacity;
  const materiallyReduced = classification.encoding === "UCS-2";
  return {
    ...classification,
    characters: [...text].length,
    code_units: text.length,
    segments,
    single_segment_capacity: singleCapacity,
    multipart_segment_capacity: multipartCapacity,
    current_capacity: capacity,
    remaining_units: capacity - classification.encodedUnits,
    explanation: materiallyReduced ? `Some characters (${classification.unicodeCharacters.slice(0, 3).join(" ")}) require Unicode SMS, reducing a single SMS from 160 to 70 characters.` : null
  };
}

