declare module "react-dom" {
  export function useFormState<State, Payload>(
    action: (state: State, formData: FormData) => Payload | Promise<Payload>,
    initialState: State,
  ): [State, (formData: FormData) => Promise<void>];

  export function useFormStatus(): {
    pending: boolean;
    data?: FormData;
    method?: string;
    action?: string;
  };
}
