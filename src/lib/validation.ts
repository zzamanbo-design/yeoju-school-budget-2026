export interface ValidationInput {
  allocatedAmount: number;
  projectCode: string;
  projectType: string;
  expenseCategory: string;
  newAmount: number;
  existingExpenditures: { expense_category: string; amount: number }[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 경기공유학교 학교맞춤형 예산 비목 상한선 자동 검증 함수
 */
export function validateExpenditure(input: ValidationInput): ValidationResult {
  const {
    allocatedAmount,
    projectCode,
    projectType,
    expenseCategory,
    newAmount,
    existingExpenditures,
  } = input;

  // 1. 전체 잔액 검증
  const totalSpent = existingExpenditures.reduce((sum, e) => sum + e.amount, 0);
  if (totalSpent + newAmount > allocatedAmount) {
    return {
      valid: false,
      error: `배정 예산 잔액이 부족합니다. (잔액: ${(allocatedAmount - totalSpent).toLocaleString()}원)`,
    };
  }

  return { valid: true };
}
