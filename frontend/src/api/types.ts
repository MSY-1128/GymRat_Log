// 서버 DTO 타입. 숫자 값은 서버 계산값(반올림 전)이며 화면에서 반올림한다.

export type SexForFormula = 'MALE' | 'FEMALE';
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN';
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type Source = 'DEMO' | 'USER' | 'MFDS' | 'CATALOG';
export type MfdsKind = 'GENERIC' | 'BRAND' | 'ALL';
/** 기초대사량 계산 방식: 키·몸무게 공식 / 체지방률(제지방량) 공식 / 측정기 값 */
export type BmrMethod = 'FORMULA' | 'BODY_FAT' | 'MEASURED';

export interface User {
  id: number;
  username: string;
}

export interface Credentials {
  username: string;
  password: string;
}

export interface Profile {
  id: number;
  age: number;
  sexForFormula: SexForFormula | null;
  heightCm: number;
  weightKg: number;
  activityFactor: number;
  goal: Goal;
  dailyTargetKcal: number | null;
  bmrMethod: BmrMethod;
  /** 실제로 계산에 쓴 방식(측정값이 없으면 FORMULA). BMR을 못 구하면 null */
  bmrAppliedMethod: BmrMethod | null;
  /** BODY_FAT·MEASURED로 계산했을 때 쓴 측정 날짜 */
  bmrMeasuredOn: string | null;
  bmrKcal: number | null;
  tdeeKcal: number | null;
  /** 최근 체지방률 측정으로 구한 제지방량 */
  leanMassKg: number | null;
  leanMassMeasuredOn: string | null;
  /** 단백질 목표(제지방 1kg당 g) */
  proteinGPerKgLean: number | null;
  proteinTargetG: number | null;
  updatedAt: string;
}

export interface ProfileInput {
  age: number;
  sexForFormula: SexForFormula | null;
  heightCm: number;
  weightKg: number;
  activityFactor: number;
  goal: Goal;
  dailyTargetKcal: number | null;
  bmrMethod: BmrMethod;
  proteinGPerKgLean: number | null;
}

export interface Food {
  id: number;
  name: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  servingGrams: number | null;
  source: Source;
  /** 원본이 100mL 기준이라 1mL ≈ 1g으로 근사한 값 */
  volumeBased: boolean;
}

/** 식약처 식품영양성분DB 검색 결과(서버가 100g 기준으로 정규화). */
export interface ExternalFood {
  externalCode: string;
  name: string;
  makerName: string | null;
  /** 원본 식품군(음식/가공식품 등) */
  dbGroupName: string | null;
  dbClassName: string | null;
  /** 외식 프랜차이즈 메뉴(식품군 음식 + 상용제품) */
  restaurant: boolean;
  category: string | null;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  servingGrams: number | null;
  /** 원본 영양성분 기준량(예: 100g, 100mL) */
  basisLabel: string;
  volumeBased: boolean;
  /** 원본에 값이 없어 0으로 둔 영양소 */
  missingNutrients: ('carbsG' | 'proteinG' | 'fatG')[];
  /** 이미 가져온 경우 FitLog 음식 ID */
  importedFoodId: number | null;
}

export interface ExternalFoodPage extends Page<ExternalFood> {
  /** 이 페이지에서 데이터 부족·오류로 제외한 건수 */
  excluded: number;
}

/** 바코드로 찾은 제품(식품안전나라). 영양성분은 items에 있다. */
export interface BarcodeProduct {
  barcode: string;
  productName: string | null;
  makerName: string | null;
  category: string | null;
  /** 대표 품목제조보고번호 */
  reportNo: string | null;
  /** 같은 바코드의 보고번호 전체(공장별로 여러 개일 수 있음) */
  reportNos: string[];
  source: string;
}

/** REPORT_NO: 보고번호로 정확히 연결 · NAME: 제품명으로 찾은 후보 · NO_NUTRITION: 영양성분DB에 없음 · NOT_FOUND: 제품 없음 */
export type BarcodeMatch = 'REPORT_NO' | 'NAME' | 'NO_NUTRITION' | 'NOT_FOUND';

export interface BarcodeLookup {
  barcode: string;
  product: BarcodeProduct | null;
  match: BarcodeMatch;
  items: ExternalFood[];
}

export interface FoodInput {
  name: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  servingGrams: number | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
}

/** STRENGTH: 헬스(세트·횟수·무게), TIME: 시간(거리 계수가 있으면 거리도) */
export type ExerciseKind = 'STRENGTH' | 'TIME';
export type BodyPart = 'CHEST' | 'BACK' | 'SHOULDER' | 'LEGS' | 'ARMS' | 'CORE';
export type WorkoutMode = 'TIME' | 'DISTANCE' | 'SETS';

export interface Exercise {
  id: number;
  name: string;
  met: number;
  source: Source;
  kind: ExerciseKind;
  energySystem: EnergySystem;
  bodyPart: BodyPart | null;
  /** 시간 운동의 강도별 MET(헬스는 null). met는 보통 강도 */
  metLight: number | null;
  metVigorous: number | null;
  /** 속도별 MET 점. 거리·속도로 강도를 정할 수 있는 운동만 값이 있다 */
  speedMetCurve: SpeedPoint[];
  /** 헬스 종목만 값이 있다 */
  equipment: Equipment | null;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  /** 동작 애니메이션 키(패턴[:변형]) */
  motion: string | null;
}

export interface SpeedPoint {
  speedKmh: number;
  met: number;
}

/** 무산소 / 유산소 / 무산소+유산소 */
export type EnergySystem = 'ANAEROBIC' | 'AEROBIC' | 'MIXED';

export const ENERGY_SYSTEMS: { value: EnergySystem; label: string }[] = [
  { value: 'ANAEROBIC', label: '무산소' },
  { value: 'AEROBIC', label: '유산소' },
  { value: 'MIXED', label: '무산소+유산소' },
];

export const energyLabel = (e: EnergySystem): string => ENERGY_SYSTEMS.find((x) => x.value === e)?.label ?? e;

export type Intensity = 'LIGHT' | 'MODERATE' | 'VIGOROUS';
export type IntensityBasis = 'LEVEL' | 'DISTANCE' | 'SPEED';

export const INTENSITIES: { value: Intensity; label: string }[] = [
  { value: 'LIGHT', label: '가볍게' },
  { value: 'MODERATE', label: '보통' },
  { value: 'VIGOROUS', label: '힘들게' },
];

export const intensityLabel = (i: Intensity): string => INTENSITIES.find((x) => x.value === i)?.label ?? i;

export type Equipment = 'BARBELL' | 'DUMBBELL' | 'MACHINE' | 'CABLE' | 'BODYWEIGHT' | 'KETTLEBELL';

export const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'BARBELL', label: '바벨' },
  { value: 'DUMBBELL', label: '덤벨' },
  { value: 'MACHINE', label: '머신' },
  { value: 'CABLE', label: '케이블' },
  { value: 'BODYWEIGHT', label: '맨몸' },
  { value: 'KETTLEBELL', label: '케틀벨' },
];

export const equipmentLabel = (e: Equipment): string => EQUIPMENT.find((x) => x.value === e)?.label ?? e;

export type Muscle =
  | 'CHEST'
  | 'FRONT_DELT'
  | 'SIDE_DELT'
  | 'REAR_DELT'
  | 'TRAPS'
  | 'LATS'
  | 'MID_BACK'
  | 'LOWER_BACK'
  | 'BICEPS'
  | 'TRICEPS'
  | 'FOREARMS'
  | 'ABS'
  | 'OBLIQUES'
  | 'GLUTES'
  | 'QUADS'
  | 'HAMSTRINGS'
  | 'ADDUCTORS'
  | 'CALVES';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  CHEST: '대흉근',
  FRONT_DELT: '전면 삼각근',
  SIDE_DELT: '측면 삼각근',
  REAR_DELT: '후면 삼각근',
  TRAPS: '승모근',
  LATS: '광배근',
  MID_BACK: '능형근·중부 등',
  LOWER_BACK: '척추기립근',
  BICEPS: '이두근',
  TRICEPS: '삼두근',
  FOREARMS: '전완근',
  ABS: '복직근',
  OBLIQUES: '복사근',
  GLUTES: '둔근',
  QUADS: '대퇴사두근',
  HAMSTRINGS: '햄스트링',
  ADDUCTORS: '내전근',
  CALVES: '종아리',
};

export const BODY_PARTS: { value: BodyPart; label: string }[] = [
  { value: 'CHEST', label: '가슴' },
  { value: 'BACK', label: '등' },
  { value: 'SHOULDER', label: '어깨' },
  { value: 'LEGS', label: '하체' },
  { value: 'ARMS', label: '팔' },
  { value: 'CORE', label: '복근' },
];

export const bodyPartLabel = (p: BodyPart): string => BODY_PARTS.find((b) => b.value === p)?.label ?? p;

export interface MealEntry {
  id: number;
  date: string;
  mealType: MealType;
  foodId: number;
  grams: number;
  foodNameSnapshot: string;
  kcalPer100Snapshot: number;
  carbsPer100Snapshot: number;
  proteinPer100Snapshot: number;
  fatPer100Snapshot: number;
  calculatedKcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export interface MealInput {
  date: string;
  mealType: MealType;
  foodId: number;
  grams: number;
}

export interface WorkoutEntry {
  id: number;
  date: string;
  exerciseId: number;
  mode: WorkoutMode;
  minutes: number | null;
  distanceKm: number | null;
  sets: number | null;
  reps: number | null;
  liftedKg: number | null;
  /** 헬스 볼륨(세트 × 횟수 × 무게) */
  volumeKg: number | null;
  /** 운동 시간(헬스는 세트 × 2.5분 추정) */
  durationMinutes: number;
  bodyPart: BodyPart | null;
  nameSnapshot: string;
  weightKgSnapshot: number;
  metSnapshot: number;
  kcalPerKgKmSnapshot: number | null;
  /** 시간 운동의 강도 기준. 이전 시간 기록은 null(보통) */
  intensityBasis: IntensityBasis | null;
  intensity: Intensity | null;
  speedKmh: number | null;
  energySystem: EnergySystem;
  calculatedKcal: number;
}

/** mode별로 필요한 값만 보낸다. TIME: minutes + (intensity | distanceKm | speedKmh) / SETS: sets·reps·liftedKg */
export interface WorkoutInput {
  date: string;
  exerciseId: number;
  mode: WorkoutMode;
  minutes?: number | null;
  distanceKm?: number | null;
  sets?: number | null;
  reps?: number | null;
  liftedKg?: number | null;
  intensity?: Intensity | null;
  speedKmh?: number | null;
}

/** 헬스 1세트(수행 + 휴식) 추정 시간. 서버 Calculator.MINUTES_PER_SET과 같다. */
export const MINUTES_PER_SET = 2.5;

export interface DailySummary {
  date: string;
  consumedKcal: number;
  targetKcal: number | null;
  remainingKcal: number | null;
  exerciseKcal: number;
  exerciseMinutes: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'BREAKFAST', label: '아침' },
  { value: 'LUNCH', label: '점심' },
  { value: 'DINNER', label: '저녁' },
  { value: 'SNACK', label: '간식' },
];

export const mealTypeLabel = (t: MealType): string =>
  MEAL_TYPES.find((m) => m.value === t)?.label ?? t;

/** 체성분 측정 기록(인바디 결과지를 직접 입력). 체지방량·제지방량은 서버 계산값. */
export interface BodyComposition {
  id: number;
  measuredOn: string;
  weightKg: number;
  bodyFatPct: number | null;
  skeletalMuscleKg: number | null;
  measuredBmrKcal: number | null;
  visceralFatLevel: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
}

export interface BodyCompositionInput {
  measuredOn: string;
  weightKg: number;
  bodyFatPct: number | null;
  skeletalMuscleKg: number | null;
  measuredBmrKcal: number | null;
  visceralFatLevel: number | null;
}

export const BMR_METHODS: { value: BmrMethod; label: string; short: string }[] = [
  { value: 'FORMULA', label: '키·몸무게 공식 (Mifflin-St Jeor)', short: '키·몸무게 공식' },
  { value: 'BODY_FAT', label: '체지방률 공식 (Katch-McArdle)', short: '체지방률 공식' },
  { value: 'MEASURED', label: '인바디 측정값', short: '인바디 측정값' },
];

export const bmrMethodLabel = (m: BmrMethod): string => BMR_METHODS.find((x) => x.value === m)?.short ?? m;
