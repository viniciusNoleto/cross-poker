import { useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import * as yup from 'yup';
import { Form } from '@/components/form/Form';
import { FormButton } from '@/components/form/Button';
import { FormTextInput } from '@/components/form/TextInput';
import { useValidatedFormState } from '@/utils/state';
import { resolveApiMessage } from '@/utils/apiMessage';
import { createRoomService } from '../services/createRoom';
import { IRoomState } from '../models/RoomPlayer';

const createRoomSchema = yup.object({
  name: yup.string().default('').required().max(40),
});

export function useCreateRoomLogicData({ onSuccess }: { onSuccess: (state: IRoomState) => void }) {
  const createRoomValidatedFormState = useValidatedFormState(createRoomSchema);

  const createRoomMutation = useMutation({
    mutationFn: () => createRoomService({ body: createRoomValidatedFormState.state }),
    onSuccess: (res) => {
      onSuccess(res.data);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.message ? resolveApiMessage(err.message, 'pt-br') : 'Não foi possível criar a sala. Tente novamente.',
        color: 'red',
      });
    },
  });

  return {
    createRoomValidatedFormState,
    createRoomMutation,
  };
}

export function CreateRoomLogicComponent({ logicData }: { logicData: ReturnType<typeof useCreateRoomLogicData> }) {
  const {
    createRoomValidatedFormState: {
      field: createRoomField,
      validate: validateCreateRoom,
    },
    createRoomMutation: {
      mutate: createRoomMutate,
      isPending: createRoomIsPending,
    },
  } = logicData;

  async function createRoom() {
    if (!await validateCreateRoom()) return;

    createRoomMutate();
  }

  return (
    <Form
      onSubmit={createRoom}
      className="flex flex-col gap-4"
    >
      <FormTextInput
        label="Seu nome"
        placeholder="Como você quer ser chamado?"
        size="md"
        radius={0}
        {...createRoomField('name')}
        required
      />

      <FormButton
        type="submit"
        color="primary"
        size="lg"
        loading={createRoomIsPending}
        rightIcon="lucide:sparkles"
      >
        Criar sala
      </FormButton>
    </Form>
  );
}
