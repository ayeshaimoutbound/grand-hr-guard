// Uniform items that have a size, and the size options for each.
export const UNIFORM_SIZE_OPTIONS: Record<string, string[]> = {
  "Shirt (Men)": ["14", "14.5", "15", "15.5", "16", "16.5", "17", "17.5", "18", "18.5"],
  "Trouser (Men)": Array.from({ length: 21 }, (_, i) => String(28 + i)),
  "Blouse (Women)": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
  "Skirt (Women)": Array.from({ length: 18 }, (_, i) => String(28 + i)),
  Shoes: ["5", "6", "7", "8", "9", "10", "11", "12"],
};

export const UNIFORM_SIZE_KEYS = Object.keys(UNIFORM_SIZE_OPTIONS);

export type UniformSizes = Record<string, string>;
