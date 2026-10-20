/** Categories used for statement transactions. Names match CashBook's built-ins so imports map cleanly. */
export type Cat = { id: string; name: string; color: string; income?: boolean };

export const CATEGORIES: Cat[] = [
  { id: "food", name: "Food & groceries", color: "#f97316" },
  { id: "transport", name: "Transportation", color: "#0ea5e9" },
  { id: "housing", name: "Housing", color: "#8b5cf6" },
  { id: "utilities", name: "Utilities", color: "#eab308" },
  { id: "shopping", name: "Shopping", color: "#ec4899" },
  { id: "health", name: "Healthcare", color: "#ef4444" },
  { id: "fun", name: "Entertainment", color: "#14b8a6" },
  { id: "subs", name: "Subscriptions", color: "#a855f7" },
  { id: "fees", name: "Fees & charges", color: "#64748b" },
  { id: "other", name: "Other", color: "#94a3b8" },
  { id: "salary", name: "Salary", color: "#12b76a", income: true },
  { id: "income", name: "Other income", color: "#10b981", income: true },
];

export const catOf = (id: string): Cat => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[9];
export const EXPENSE_CATS = CATEGORIES.filter((c) => !c.income);
export const INCOME_CATS = CATEGORIES.filter((c) => c.income);
