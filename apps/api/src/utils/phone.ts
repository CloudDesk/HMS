export function getPhoneVariants(phone: string): string[] {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return [trimmed];

  const variants = new Set<string>();
  variants.add(trimmed);
  variants.add(digits);
  variants.add(`+${digits}`);

  if (digits.length >= 10) {
    const core10 = digits.slice(-10);
    variants.add(core10);
    variants.add(`+91${core10}`);
    variants.add(`91${core10}`);
    variants.add(`0${core10}`);
    variants.add(`+91 ${core10}`);
    variants.add(`+${core10}`);
  } else if (digits.length >= 7) {
    const core7 = digits.slice(-7);
    variants.add(core7);
    variants.add(`0${core7}`);
  }

  return Array.from(variants);
}

export function buildPhoneMongoFilter(phone: string, fieldName = 'phone') {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  const variants = getPhoneVariants(phone);

  if (digits.length >= 7) {
    const core = digits.length >= 10 ? digits.slice(-10) : digits;
    const regex = new RegExp(`(?:\\+?\\d{1,4}[\\s-]?)?0?${core}$`);
    return {
      $or: [
        { [fieldName]: { $in: variants } },
        { [fieldName]: regex },
      ],
    };
  }

  return { [fieldName]: { $in: variants } };
}
