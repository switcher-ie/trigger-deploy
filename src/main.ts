import * as core from '@actions/core'
import * as github from '@actions/github'
import {DeploymentEnvironment} from './DeploymentEnvironment'
import {Endpoints} from '@octokit/types'
// import * as Event from '@octokit/webhooks'

type CreateDeployment = Endpoints['POST /repos/{owner}/{repo}/deployments']
type CreateDeploymentResponse = CreateDeployment['response']
type Deployment = CreateDeploymentResponse['data']

async function triggerDeployment(): Promise<Deployment[]> {
  const app = core.getInput('APP')
  const environment = core.getInput('ENVIRONMENT')
  const namespace = core.getInput('NAMESPACE')
  const ref = core.getInput('REF')

  const token = core.getInput('GITHUB_TOKEN')
  const client = github.getOctokit(token)

  core.info(`APP: ${app}`)
  core.info(`ENVIRONMENT: ${environment}`)
  core.info(`NAMESPACE: ${namespace}`)
  core.info(`REF: ${ref}`)

  if (app === '' && environment === '' && namespace === '' && ref === '') {
    // Guess deployment based on event
    //   - if push event: on master, create single production deployment; create staging deployment for each
    //     label which doesn't have an open PR assigned.
    //   - if PR event: check PR for labels, create staging deployment for each match label.
    //   - else: fail step

    return []
  } else {
    // Create a deployment based on the arguments
    const deploymentEnviroment = new DeploymentEnvironment(
      environment,
      namespace
    )

    core.info(`deployment environment: ${deploymentEnviroment.toString()}`)

    const response = await client.repos.createDeployment({
      owner: 'switcher-ie',
      repo: app,
      ref,
      task: 'deploy',
      auto_merge: false,
      environment: deploymentEnviroment.toString(),
      required_contexts: []
    })

    core.info(response.status.toString())

    const deployment = response.data
    if (deployment) {
      core.info(typeof deployment)
      return [deployment]
    } else {
      core.setFailed('deployment not created')
      return []
    }
  }
}

async function run(): Promise<void> {
  try {
    core.info('running...')
    const deployments = await triggerDeployment()
    core.setOutput('DEPLOYMENTS', JSON.stringify(deployments))
    core.setOutput('DEPLOYMENT', JSON.stringify(deployments[0]))
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
