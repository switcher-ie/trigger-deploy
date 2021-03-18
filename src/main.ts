import * as core from '@actions/core'
import * as github from '@actions/github'
import {DeploymentEnvironment} from './DeploymentEnvironment'
import {Environment} from './Environment'
import {Octokit} from '@octokit/core'
import {Endpoints} from '@octokit/types'
import {PushEvent, PullRequestEvent} from '@octokit/webhooks-definitions/schema'

type CreateDeployment = Endpoints['POST /repos/{owner}/{repo}/deployments']
type CreateDeploymentResponse = CreateDeployment['response']
type Deployment = CreateDeploymentResponse['data']

async function createDeployment(
  client: Octokit,
  app: string,
  environment: DeploymentEnvironment,
  ref: string
): Promise<Deployment> {
  const response = await client.repos.createDeployment({
    owner: 'switcher-ie',
    repo: app,
    ref,
    task: 'deploy',
    auto_merge: false,
    environment: environment.toString()
  })

  return response.data
}

async function triggerDeploymentsFromPushEvent(
  client: Octokit,
  event: PushEvent
): Promise<Deployment[]> {
  if (event.ref !== 'refs/heads/master') {
    return []
  }

  const app = event.repository.name
  const environment = new DeploymentEnvironment(Environment.Production, '')
  const ref = event.after

  const deployment = await createDeployment(client, app, environment, ref)
  return [deployment]
}

async function triggerDeploymentsFromPullRequestEvent(
  client: Octokit,
  event: PullRequestEvent
): Promise<Deployment[]> {
  const app = event.repository.name

  const labelNames = event.pull_request.labels.map(label => label.name)

  const stagingEnvironmentNames = (name: string): boolean =>
    name.startsWith(`${Environment.Staging}/`)
  const deployments = labelNames.filter(stagingEnvironmentNames).map(
    async (labelName): Promise<Deployment> => {
      const environment = DeploymentEnvironment.fromLabelName(labelName)

      return createDeployment(
        client,
        app,
        environment,
        event.pull_request.head.sha
      )
    }
  )

  return Promise.all(deployments)
}

async function triggerDeployment(): Promise<Deployment[]> {
  const app = core.getInput('APP')
  const environment = core.getInput('ENVIRONMENT')
  const namespace = core.getInput('NAMESPACE')
  const ref = core.getInput('REF')

  const token = core.getInput('GITHUB_ACCESS_TOKEN')
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

    let event

    switch (github.context.eventName) {
      case 'push':
        event = github.context.payload as PushEvent
        return await triggerDeploymentsFromPushEvent(client, event)
      case 'pull_request':
        event = github.context.payload as PullRequestEvent
        return await triggerDeploymentsFromPullRequestEvent(client, event)
      default:
        core.setFailed(
          `executed with unsupported event: ${github.context.eventName}`
        )
        return []
    }
  } else {
    // Create a deployment based on the arguments
    const deploymentEnviroment = new DeploymentEnvironment(
      environment,
      namespace
    )

    core.info(`deployment environment: ${deploymentEnviroment.toString()}`)

    const deployment = await createDeployment(
      client,
      app,
      deploymentEnviroment,
      ref
    )
    return [deployment]
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
