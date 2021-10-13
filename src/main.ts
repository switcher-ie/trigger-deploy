import * as core from '@actions/core'
import * as github from '@actions/github'
import {WebhookPayload} from '@actions/github/lib/interfaces'
import {GitHub} from '@actions/github/lib/utils'
import {DeploymentEnvironment} from './DeploymentEnvironment'
import {Environment} from './Environment'

import {Endpoints} from '@octokit/types'
import {
  Label,
  EventPayloadMap,
  PushEvent,
  PullRequest,
  PullRequestEvent
} from '@octokit/webhooks-types'

type CreateDeployment = Endpoints['POST /repos/{owner}/{repo}/deployments']
type CreateDeploymentResponse = CreateDeployment['response']
type Deployment = CreateDeploymentResponse['data']

type GitHubClient = InstanceType<typeof GitHub>

const ORGANISATION = 'switcher-ie'

function extractEvent<
  EventName extends keyof EventPayloadMap,
  Event extends EventPayloadMap[EventName]
>(eventName: EventName, payload: WebhookPayload): Event {
  return payload as Event
}

async function createDeployment(
  client: GitHubClient,
  app: string,
  environment: DeploymentEnvironment,
  sha: string
): Promise<Deployment> {
  core.info(`Triggered Deployment: ${app} ${environment} @ ${sha}`)

  const response = await client.repos.createDeployment({
    owner: ORGANISATION,
    repo: app,
    ref: sha,
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
  client: GitHubClient,
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
  client: GitHubClient,
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
  client: GitHubClient,
  event: PushEvent
): Promise<Deployment[]> {
  if (event.ref !== 'refs/heads/master' && event.ref !== 'refs/heads/main') {
    return []
  }

  const app = event.repository.name
  const sha = event.after

  const productionDeployment = await createDeployment(
    client,
    app,
    new DeploymentEnvironment(Environment.Production, ''),
    sha
  )

  const configured = [...(await configuredDeploymentEnvironments(client, app))]
  const reserved = [
    ...(await reservedDeploymentEnvironments(client, app))
  ].map(e => e.toString())

  const needsMasterUpdate = configured.filter(
    environment => !reserved.includes(environment.toString())
  )

  const stagingDeployments = needsMasterUpdate.map(
    async (deploymentEnvironment): Promise<Deployment> => {
      return createDeployment(client, app, deploymentEnvironment, sha)
    }
  )

  return [productionDeployment].concat(await Promise.all(stagingDeployments))
}

async function triggerDeploymentsFromPullRequestEvent(
  client: GitHubClient,
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
  const sha = core.getInput('SHA')

  const token = core.getInput('GITHUB_ACCESS_TOKEN')
  const client: GitHubClient = github.getOctokit(token)

  core.info(`APP: ${app}`)
  core.info(`ENVIRONMENT: ${environment}`)
  core.info(`NAMESPACE: ${namespace}`)
  core.info(`sha: ${sha}`)

  if (app === '' && environment === '' && namespace === '' && sha === '') {
    // Guess deployment based on event
    //   - if push event: on master or main, create single production deployment; create staging deployment for each
    //     label which doesn't have an open PR assigned.
    //   - if PR event: check PR for labels, create staging deployment for each match label.
    //   - else: fail step

    switch (github.context.eventName) {
      case 'push':
        return await triggerDeploymentsFromPushEvent(
          client,
          extractEvent(github.context.eventName, github.context.payload)
        )
      case 'pull_request':
        return await triggerDeploymentsFromPullRequestEvent(
          client,
          extractEvent(github.context.eventName, github.context.payload)
        )
      case 'pull_request_target':
        return await triggerDeploymentsFromPullRequestEvent(
          client,
          github.context.payload as PullRequestEvent
        )
      default:
        throw new Error(
          `executed with unsupported event: ${github.context.eventName}`
        )
    }
  } else {
    // Create a deployment based on the arguments
    const deploymentEnviroment = new DeploymentEnvironment(
      environment,
      namespace
    )

    const deployment = await createDeployment(
      client,
      app,
      deploymentEnviroment,
      sha
    )
    return [deployment]
  }
}

async function run(): Promise<void> {
  try {
    const deployments = await triggerDeployment()
    core.setOutput('DEPLOYMENTS', JSON.stringify(deployments))
    core.setOutput('DEPLOYMENT', JSON.stringify(deployments[0]))
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
