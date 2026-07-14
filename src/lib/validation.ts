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

  // 2. 강사비 검증: 40~50% 상한 (총 예산의 50% 초과 불가)
  if (expenseCategory === "강사비") {
    const currentLecturerSpent = existingExpenditures
      .filter((e) => e.expense_category === "강사비")
      .reduce((sum, e) => sum + e.amount, 0);

    const lecturerLimit = allocatedAmount * 0.5; // 50% 상한선
    if (currentLecturerSpent + newAmount > lecturerLimit) {
      return {
        valid: false,
        error: `강사비 지출은 전체 사업 예산의 50%를 초과할 수 없습니다. (현재 지출액: ${currentLecturerSpent.toLocaleString()}원, 상한선: ${lecturerLimit.toLocaleString()}원)`,
      };
    }
  }

  // 3. 학생 주·부식비 검증: 전체 예산의 10% 이내 제한
  const isSnack =
    expenseCategory === "학생 주·부식비" ||
    expenseCategory === "주·부식비" ||
    expenseCategory === "학생 주부식비";

  if (isSnack) {
    const currentSnackSpent = existingExpenditures
      .filter(
        (e) =>
          e.expense_category === "학생 주·부식비" ||
          e.expense_category === "주·부식비" ||
          e.expense_category === "학생 주부식비"
      )
      .reduce((sum, e) => sum + e.amount, 0);

    const snackLimit = allocatedAmount * 0.1; // 10% 제한
    if (currentSnackSpent + newAmount > snackLimit) {
      return {
        valid: false,
        error: `학생 주·부식비는 전체 사업 예산의 10%를 초과할 수 없습니다. (현재 지출액: ${currentSnackSpent.toLocaleString()}원, 상한선: ${snackLimit.toLocaleString()}원)`,
      };
    }
  }

  // 4. 특정 공모 사업의 업무추진비 검증: 5% 또는 30% 이내 동적 제한
  if (expenseCategory === "업무추진비" && projectType === "공모") {
    const currentExecSpent = existingExpenditures
      .filter((e) => e.expense_category === "업무추진비")
      .reduce((sum, e) => sum + e.amount, 0);

    // 세부 코드에 따른 동적 한도 적용 (112: 5%, 113: 30%, 그 외 기본 5%)
    let limitPercent = 5;
    if (projectCode === "113") {
      limitPercent = 30;
    } else if (projectCode === "112") {
      limitPercent = 5;
    } else {
      limitPercent = 5; // 기본 상한선 5%
    }

    const execLimit = allocatedAmount * (limitPercent / 100);
    if (currentExecSpent + newAmount > execLimit) {
      return {
        valid: false,
        error: `공모 사업(${projectCode})의 업무추진비는 전체 예산의 ${limitPercent}%를 초과할 수 없습니다. (현재 지출액: ${currentExecSpent.toLocaleString()}원, 상한선: ${execLimit.toLocaleString()}원)`,
      };
    }
  }

  return { valid: true };
}
