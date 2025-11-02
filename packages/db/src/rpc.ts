import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { RpcArgs, RpcInvokeOptions, RpcName, RpcResponse, TypedSupabaseClient } from './types';

export const callRpc = async <TName extends RpcName>(
  client: TypedSupabaseClient,
  name: TName,
  args: RpcArgs<TName>,
  options?: RpcInvokeOptions,
): Promise<PostgrestSingleResponse<RpcResponse<TName>>> => {
  return client.rpc(name as string, args, options).returns<RpcResponse<TName>>();
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
