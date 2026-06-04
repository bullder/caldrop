/** Consumer data list types (spec `ListType` enum). */

export enum ListType {
  NDZ = "NDZ",
  EMAIL = "EMAIL",
  PHONE = "PHONE",
  MAID = "MAID",
  NVIN = "NVIN",
  CTVID = "CTVID",
}

/** Spec-defined order — drives iteration (archive files, preview columns). */
export const LIST_TYPES: ListType[] = [
  ListType.NDZ,
  ListType.EMAIL,
  ListType.PHONE,
  ListType.MAID,
  ListType.NVIN,
  ListType.CTVID,
];

// File-name casing per the spec examples (NDZ.csv, Email.csv, Phone.csv...).
const FILE_LABEL: Record<ListType, string> = {
  [ListType.NDZ]: "NDZ",
  [ListType.EMAIL]: "Email",
  [ListType.PHONE]: "Phone",
  [ListType.MAID]: "MAID",
  [ListType.NVIN]: "NVIN",
  [ListType.CTVID]: "CTVID",
};

/** Casing used in CSV file names (e.g. EMAIL -> 'Email'). */
export function fileLabel(t: ListType): string {
  return FILE_LABEL[t];
}

/**
 * Parse a comma-separated env value into ListType members.
 * Throws on any unrecognized token.
 */
export function parseLists(raw: string): ListType[] {
  const result: ListType[] = [];
  for (const token of raw.split(",")) {
    const name = token.trim().toUpperCase();
    if (!name) continue;
    if ((Object.values(ListType) as string[]).includes(name)) {
      result.push(name as ListType);
    } else {
      const valid = LIST_TYPES.join(", ");
      throw new Error(`Unknown list type '${name}'. Valid: ${valid}`);
    }
  }
  return result;
}
