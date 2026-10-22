const PASSWORD_RULES = [
  {
    message: "Use at least 12 characters.",
    test: (password: string) => Array.from(password).length >= 12,
  },
  {
    message: "Include an uppercase letter.",
    test: (password: string) => /\p{Lu}/u.test(password),
  },
  {
    message: "Include a lowercase letter.",
    test: (password: string) => /\p{Ll}/u.test(password),
  },
  {
    message: "Include a number.",
    test: (password: string) => /\p{N}/u.test(password),
  },
  {
    message: "Include a symbol.",
    test: (password: string) => /[\p{P}\p{S}]/u.test(password),
  },
] as const;

export function validatePassword(pw: string): {
  valid: boolean;
  failures: string[];
} {
  const failures = PASSWORD_RULES
    .filter(({ test }) => !test(pw))
    .map(({ message }) => message);

  return { valid: failures.length === 0, failures };
}

export function scorePassword(pw: string): number {
  return PASSWORD_RULES.length - validatePassword(pw).failures.length;
}
