import {
  EnvironmentIsValid,
  EnvironmentHasMultipleNamespaces
} from './environment'

export class DeploymentEnvironment {
  environment: string
  namespace?: string

  static fromLabel(label: {name: string}): DeploymentEnvironment {
    const [environment, namespace] = label.name.split('/')
    return new DeploymentEnvironment(environment, namespace)
  }

  constructor(environment: string, namespace: string) {
    if (!EnvironmentIsValid(environment)) {
      throw new Error(`invalid environment: '${environment}'`)
    }

    this.environment = environment

    if (EnvironmentHasMultipleNamespaces(environment)) {
      if (namespace === '') {
        throw new Error(`invalid namespace: '${namespace}'`)
      }

      this.namespace = namespace
    }
  }

  toString(): string {
    if (EnvironmentHasMultipleNamespaces(this.environment)) {
      return `${this.environment}/${this.namespace}`
    } else {
      return this.environment
    }
  }
}
