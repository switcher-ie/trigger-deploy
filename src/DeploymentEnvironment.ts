import {Environment} from './Environment'

export class DeploymentEnvironment {
  environment: string
  namespace?: string

  constructor(environment: string, namespace: string) {
    if (
      environment !== Environment.Staging &&
      environment !== Environment.Production
    ) {
      throw new Error(`invalid environment: '${environment}'`)
    }

    this.environment = environment

    if (environment !== Environment.Production) {
      if (namespace === '') {
        throw new Error(`invalid namespace: '${namespace}'`)
      }

      this.namespace = namespace
    }
  }

  toString(): string {
    if (this.environment === Environment.Production) {
      return this.environment
    } else {
      return `${this.environment}/${this.namespace}`
    }
  }
}