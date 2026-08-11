import { GetParametersByPathCommand, Parameter, SSMClient } from '@aws-sdk/client-ssm';

/**
 * Dynamically fetches all parameters from AWS SSM Parameter Store
 * and injects them into process.env BEFORE the NestJS application boots.
 */
export async function loadSsmParameters(): Promise<void> {
  const pathPrefix: string | undefined = process.env.SSM_PATH_PREFIX;

  // Only attempt to load SSM parameters if we are explicitly given a path prefix.
  // This prevents the application from crashing during local development without AWS credentials.
  if (!pathPrefix) {
    return;
  }

  // If AWS_REGION is not set by ECS natively, default to us-east-1
  const region: string = process.env.AWS_REGION ?? 'us-east-1';

  console.log(`[SSM Loader] Fetching parameters from ${pathPrefix} in ${region}...`);

  const client = new SSMClient({ region });
  let nextToken: string | undefined;

  try {
    do {
      const command = new GetParametersByPathCommand({
        Path: pathPrefix,
        WithDecryption: true,
        Recursive: true,
        NextToken: nextToken,
      });

      const response = await client.send(command);
      const parameters: Parameter[] = response.Parameters ?? [];

      for (const param of parameters) {
        const key = extractKeyFromParamName(param.Name);
        if (key && param.Value !== undefined) {
          process.env[key] = param.Value;
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    console.log(
      `[SSM Loader] Successfully loaded all parameters from SSM into process.env!`,
      process.env,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SSM Loader] FATAL ERROR: Failed to load parameters from SSM: ${message}`);
    // Crash the application immediately so ECS knows the container failed to boot
    throw error;
  }
}

function extractKeyFromParamName(name: string | undefined): string | undefined {
  if (!name) {
    return undefined;
  }
  const segments = name.split('/');
  const key = segments.pop();
  return key && key.length > 0 ? key : undefined;
}
