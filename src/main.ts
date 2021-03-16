import * as core from '@actions/core'
// import * as github from '@actions/github'
// import {Endpoints} from '@octokit/types'
// import * as Event from '@octokit/webhooks'

// type CreateDeployment = Endpoints['POST /repos/{owner}/{repo}/deployments']
// type CreateDeploymentResponse = CreateDeployment['response']

async function run(): Promise<void> {
  try {
    const environment = core.getInput('ENVIRONMENT')
    const namespace = core.getInput('NAMESPACE')
    const ref = core.getInput('REF')

    // const token = core.getInput('GITHUB_TOKEN')
    // const client = github.getOctokit(token)

    if (environment === '' && namespace === '' && ref === '') {
      // Guess deployment based on event
      //   - if push event: on master, create single production deployment; create staging deployment for each
      //     label which doesn't have an open PR assigned.
      //   - if PR event: check PR for labels, create staging deployment for each match label.
      //   - else: fail step
    } else {
      // Create a deployment based on the arguments
    }

    // Output all deployments which have been created.
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
