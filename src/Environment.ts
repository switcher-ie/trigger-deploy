export enum Environment {
  Admin = 'admin',
  Redirects = 'redirects',
  Staging = 'staging',
  Production = 'production'
}

export function EnvironmentIsValid(value: string): boolean {
  return (Object.values(Environment) as string[]).includes(value)
}

export function EnvironmentHasMultipleNamespaces(
  environment: Environment | string
): boolean {
  return environment === Environment.Staging
}
