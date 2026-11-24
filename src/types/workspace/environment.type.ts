export interface EnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  secret: boolean;
}

export interface Environment {
  id: string;
  name: string;
  seq: number;
  variables: EnvironmentVariable[];
}
