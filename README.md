# `trigger-deploy`

A GitHub Action to create GitHub Deployments, which serve as a trigger for a `deployment` workflow to actually
deploy the specified commit.

It can operate explicitly, by specifying the arguments declared in [`action.yml`](./action.yml), or implicitly
where the action determines which deployments to create depending on the event which triggered it.

 - in case of a `push` event on the master branch; create single production deployment and create staging
   deployment for each staging environment label which doesn't have an open PR assigned.
 - in the case of a `pull_request` event; check the Pull Request for labels and create staging deployment for each
   matching label.

## Getting Started

This is a TypeScript project, but GitHub Actions must be JavaScript so we also commit the compiled Javascript
package. Before committing run the following, and commit the `dist` folder:

    npm run all

This runs the following commands, which can also be run independently:

 - `npm run build` - compile TypeScript
 - `npm run format` - format source
 - `npm run lint` - lint source
 - `npm run package` - compile a module into a single file
 - `npm test` - run tests
 