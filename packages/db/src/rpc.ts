import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { RpcArgs, RpcInvokeOptions, RpcName, RpcResponse, TypedSupabaseClient } from './types';

type RpcParameters = Parameters<TypedSupabaseClient['rpc']>;

export const callRpc = async <TName extends RpcName>(
  client: TypedSupabaseClient,
  name: TName,
  args: RpcArgs<TName>,
  options?: RpcInvokeOptions,
): Promise<PostgrestSingleResponse<RpcResponse<TName>>> => {
  const response = await client.rpc(
    name as RpcParameters[0],
    (args ?? undefined) as RpcParameters[1],
    options,
  );
  return response as PostgrestSingleResponse<RpcResponse<TName>>;
};

export const callRpcOrThrow = async <TName extends RpcName>(
  client: TypedSupabaseClient,
  name: TName,
  args: RpcArgs<TName>,
  options?: RpcInvokeOptions,
): Promise<RpcResponse<TName>> => {
  const { data, error } = await callRpc(client, name, args, options);
  if (error) {
    throw error;
  }
  return data as RpcResponse<TName>;
};

export const createRpcCaller = (client: TypedSupabaseClient) => ({
  call: <TName extends RpcName>(name: TName, args: RpcArgs<TName>, options?: RpcInvokeOptions) =>
    callRpc(client, name, args, options),
  callOrThrow: <TName extends RpcName>(name: TName, args: RpcArgs<TName>, options?: RpcInvokeOptions) =>
    callRpcOrThrow(client, name, args, options),
});
