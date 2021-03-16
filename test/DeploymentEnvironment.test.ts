import {DeploymentEnvironment} from '../src/Deploymentenvironment'

test('instantiates with production environment', () => {
  const environment = new DeploymentEnvironment('production', '')
  expect(environment.environment).toEqual('production')
  expect(environment.namespace).toBeUndefined()
})

test('instantiates with staging environment & namespace', () => {
  const environment = new DeploymentEnvironment('staging', 'magenta')
  expect(environment.environment).toEqual('staging')
  expect(environment.namespace).toEqual('magenta')
})

test('throws error with blank environment', () => {
  expect(() => {
    new DeploymentEnvironment('', '')
  }).toThrow("invalid environment: ''")
})

test('throws error with unknown environment', () => {
  expect(() => {
    new DeploymentEnvironment('unknown', '')
  }).toThrow("invalid environment: 'unknown'")
})

test('throws error with staging environment and blank namespace', () => {
  expect(() => {
    new DeploymentEnvironment('staging', '')
  }).toThrow("invalid namespace: ''")
})

test('toString with production environment', () => {
  const environment = new DeploymentEnvironment('production', '')
  expect(environment.toString()).toEqual('production')
})

test('toString with staging environment', () => {
  const environment = new DeploymentEnvironment('staging', 'magenta')
  expect(environment.toString()).toEqual('staging/magenta')
})
