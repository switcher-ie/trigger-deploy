import * as core from '@actions/core'
import * as github from '@actions/github'
import {DeploymentEnvironment} from './DeploymentEnvironment'
import {Environment} from './Environment'
import {Octokit} from '@octokit/core'
import {Endpoints} from '@octokit/types'
import {
  Label,
  PushEvent,
  PullRequest,
  PullRequestEvent
} from '@octokit/webhooks-definitions/schema'

type CreateDeployment = Endpoints['POST /repos/{owner}/{repo}/deployments']
type CreateDeploymentResponse = CreateDeployment['response']
type Deployment = CreateDeploymentResponse['data']

const ORGANISATION = 'switcher-ie'

async function createDeployment(
  client: Octokit,
  app: string,
  environment: DeploymentEnvironment,
  ref: string
): Promise<Deployment> {
  const response = await client.repos.createDeployment({
    owner: ORGANISATION,
    repo: app,
    ref,
    task: 'deploy',
    auto_merge: false,
    environment: environment.toString(),
    required_contexts: []
  })

  return response.data
}

function representsStagingDeploymentEnvironment(label: Label): boolean {
  return label.name.startsWith(`${Environment.Staging}/`)
}

async function configuredDeploymentEnvironments(
  client: Octokit,
  app: string
): Promise<Set<DeploymentEnvironment>> {
  const labels = (await client.paginate(client.issues.listLabelsForRepo, {
    owner: ORGANISATION,
    repo: app
  })) as Label[]

  const stagingDeploymentEnvironments = labels
    .filter(representsStagingDeploymentEnvironment)
    .map(label => DeploymentEnvironment.fromLabel(label))

  return new Set(stagingDeploymentEnvironments)
}

async function reservedDeploymentEnvironments(
  client: Octokit,
  app: string
): Promise<Set<DeploymentEnvironment>> {
  const openPullRequests = (await client.paginate(client.pulls.list, {
    owner: ORGANISATION,
    repo: app,
    state: 'open'
  })) as PullRequest[]

  return openPullRequests.reduce(
    (memo: Set<DeploymentEnvironment>, pull_request: PullRequest) => {
      const environments = pull_request.labels
        .filter(representsStagingDeploymentEnvironment)
        .map(label => DeploymentEnvironment.fromLabel(label))
      for (const stagingDeploymentEnvironment of environments) {
        memo.add(stagingDeploymentEnvironment)
      }

      return memo
    },
    new Set()
  )
}

async function triggerDeploymentsFromPushEvent(
  client: Octokit,
  event: PushEvent
): Promise<Deployment[]> {
  if (event.ref !== 'refs/heads/master') {
    return []
  }

  const app = event.repository.name
  const ref = event.after

  const productionDeployment = await createDeployment(
    client,
    app,
    new DeploymentEnvironment(Environment.Production, ''),
    ref
  )

  const reserved = await reservedDeploymentEnvironments(client, app)
  const needsMasterUpdate = [
    ...(await configuredDeploymentEnvironments(client, app))
  ].filter(environment => !reserved.has(environment))

  const stagingDeployments = needsMasterUpdate.map(
    async (deploymentEnvironment): Promise<Deployment> => {
      return createDeployment(client, app, deploymentEnvironment, ref)
    }
  )

  return [productionDeployment].concat(await Promise.all(stagingDeployments))
}

async function triggerDeploymentsFromPullRequestEvent(
  client: Octokit,
  event: PullRequestEvent
): Promise<Deployment[]> {
  const app = event.repository.name

  const labels = event.pull_request.labels

  const deployments = labels.filter(representsStagingDeploymentEnvironment).map(
    async (label): Promise<Deployment> => {
      const environment = DeploymentEnvironment.fromLabel(label)

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
