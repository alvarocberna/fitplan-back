export type Skinfolds4Type = {
  biceps: number;
  triceps: number;
  subscapular: number;
  iliacCrest: number;
};

export type Skinfolds6Type = {
  triceps: number;
  subscapular: number;
  supraspinal: number;
  abdominal: number;
  thigh: number;
  calf: number;
};

export type Skinfolds8Type = {
  triceps: number;
  subscapular: number;
  biceps: number;
  iliacCrest: number;
  supraspinal: number;
  abdominal: number;
  thigh: number;
  calf: number;
};

export function sumSkinfolds4(props: Skinfolds4Type) {
  const { biceps, triceps, subscapular, iliacCrest } = props;
  const sum = biceps + triceps + subscapular + iliacCrest;
  return sum;
}

export function sumSkinfolds6(props: Skinfolds6Type) {
  const { triceps, subscapular, supraspinal, abdominal, thigh, calf } = props;
  const sum = triceps + subscapular + supraspinal + abdominal + thigh + calf;
  return sum;
}

export function sumSkinfolds8(props: Skinfolds8Type) {
  const {
    triceps,
    subscapular,
    biceps,
    iliacCrest,
    supraspinal,
    abdominal,
    thigh,
    calf,
  } = props;
  const sum =
    triceps +
    subscapular +
    biceps +
    iliacCrest +
    supraspinal +
    abdominal +
    thigh +
    calf;
  return sum;
}
