import {
  GetParametersByPathCommand,
  SSMClient,
  GetParametersByPathCommandOutput,
} from '@aws-sdk/client-ssm';

/**
 * Dynamically fetches all parameters from AWS SSM Parameter Store
 * and injects them into process.env BEFORE the NestJS application boots.
 */
export async function loadSsmParameters() {
  const pathPrefix = process.env.SSM_PATH_PREFIX;

  // Only attempt to load SSM parameters if we are explicitly given a path prefix.
  // This prevents the application from crashing during local development without AWS credentials.
  if (!pathPrefix) {
    return;
  }

  // If AWS_REGION is not set by ECS natively, default to us-east-1
  const region = process.env.AWS_REGION || 'us-east-1';

  console.log(`[SSM Loader] Fetching parameters from ${pathPrefix} in ${region}...`);

  const client = new SSMClient({ region });
  let nextToken: string | undefined = undefined;

  try {
    do {
      const command = new GetParametersByPathCommand({
        Path: pathPrefix,
        WithDecryption: true,
        NextToken: nextToken,
      });

      const response = (await client.send(command)) as GetParametersByPathCommandOutput;

      if (response.Parameters) {
        for (const param of response.Parameters) {
          if (param.Name && param.Value) {
            // Extract just the variable name (e.g. /nestjs-demo/prod/DB_HOST -> DB_HOST)
            const key = param.Name.split('/').pop();
            if (key) {
              process.env[key] = param.Value;
            }
          }
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    console.log(`[SSM Loader] Successfully loaded all parameters from SSM into process.env!`, process.env);
  } catch (error) {
    console.error(`[SSM Loader] FATAL ERROR: Failed to load parameters from SSM:`, error);
    // Crash the application immediately so ECS knows the container failed to boot
    throw error;
  }
}
