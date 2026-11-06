import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import * as yup from 'yup';
import { Form } from '@/components/form/Form';
import { FormButton } from '@/components/form/Button';
import { FormTextInput } from '@/components/form/TextInput';
import { useValidatedFormState } from '@/utils/state';
import { resolveApiMessage } from '@/utils/apiMessage';
import { joinRoomService } from '../services/joinRoom';
import { IRoomState } from '../models/RoomPlayer';

const joinRoomSchema = yup.object({
  name: yup.string().default('').required().max(40),
  code: yup.string().default('').required().max(8),
});

export function useJoinRoomLogicData({ onSuccess }: { onSuccess: (state: IRoomState) => void }) {
  const joinRoomValidatedFormState = useValidatedFormState(joinRoomSchema);

  const joinRoomMutation = useMutation({
    mutationFn: () => {
      const { name, code } = joinRoomValidatedFormState.state;

      return joinRoomService({ code: code.trim().toUpperCase(), body: { name } });
    },
    onSuccess: (res) => {
      onSuccess(res.data);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível entrar na sala. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    joinRoomValidatedFormState,
    joinRoomMutation,
  };
}

export function JoinRoomLogicComponent({ logicData }: { logicData: ReturnType<typeof useJoinRoomLogicData> }) {
  const {
    joinRoomValidatedFormState: {
      field: joinRoomField,
      validate: validateJoinRoom,
    },
    joinRoomMutation: {
      mutate: joinRoomMutate,
      isPending: joinRoomIsPending,
    },
  } = logicData;

  async function joinRoom() {
    if (!await validateJoinRoom()) return;

    joinRoomMutate();
  }

  return (
    <Form
      onSubmit={joinRoom}
      className="flex flex-col gap-4"
    >
      <FormTextInput
        label="Seu nome"
        placeholder="Como você quer ser chamado?"
        size="md"
        radius={0}
        {...joinRoomField('name')}
        required
      />

      <FormTextInput
        label="Código da sala"
        placeholder="Ex: 7K2P9M"
        size="md"
        radius={0}
        {...joinRoomField('code')}
        classNames={{ input: 'uppercase tracking-[0.12em]' }}
        required
      />

      <FormButton
        type="submit"
        color="secondary"
        size="lg"
        radius={0}
        loading={joinRoomIsPending}
        rightIcon="lucide:log-in"
      >
        Entrar na sala
      </FormButton>
    </Form>
  );
}
