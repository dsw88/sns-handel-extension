# SNS Handel Extension
This repository contains a Handel extension that provides the SNS service. Handel itself already ships with an SNS service, but this is meant to be a simple example extension that people can look at as they write other Handel extensions.

# Usage
To use this extension, add it to the `extensions` section of your Handel file, and then add the `sns` service to your environment:

```yaml
version: 1

name: sns-ext-example

extensions: # This tells Handel to import this extension
  sns: sns-handel-extension # This is the NPM package name of this extension

environments:
  dev:
    task:
      type: sns::sns # You must use the <extensionName>::<serviceType> syntax here
```

# Consuming this service
You can list this service as a dependency of other services (Beanstalk, CodeDeploy, etc.). This service outputs the following environment variables when consumed by another service:

| Environment Variable      | Description                      |
| ------------------------- | -------------------------------- |
| <SERVICE_NAME>_TOPIC_ARN  | The AWS ARN of the created topic |
| <SERVICE_NAME>_TOPIC_NAME	| The name of the created topic    |
