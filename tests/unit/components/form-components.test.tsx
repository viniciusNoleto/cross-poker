import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n, { LANGUAGE_STORAGE_KEY } from '@/libs/i18n';
import { FormTextInput } from '@/components/form/TextInput';
import { FormPassword } from '@/components/form/Password';
import { FormTextarea } from '@/components/form/Textarea';
import { FormNumberInput } from '@/components/form/Number';
import { FormSwitch } from '@/components/form/Switch';
import { FormSelect } from '@/components/form/Select';
import { FormMultiSelect } from '@/components/form/MultiSelect';
import { FormDatePicker } from '@/components/form/DatePicker';
import { FormDateTimePicker } from '@/components/form/DateTimePicker';
import { FormAutocomplete } from '@/components/form/Autocomplete';
import { FormButton } from '@/components/form/Button';
import { UtilsTable } from '@/components/utils/Table';
import { ErrorBoundary } from '@/components/utils/ErrorBoundary';
import { LanguageSwitcher } from '@/components/utils/LanguageSwitcher';
import { UtilsServiceWorker } from '@/components/utils/ServiceWorker';
import { renderWithProviders } from '../../support/render';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// Contrato dos wrappers (ver .claude/rules/components-form-inputs.md): `onChange` recebe o VALOR já
// extraído (não o evento) e `onValidate` roda no blur e quando o valor muda.
describe('inputs de texto', () => {
  it.each([
    ['FormTextInput', FormTextInput],
    ['FormPassword', FormPassword],
    ['FormTextarea', FormTextarea],
  ])('%s: onChange recebe a string e onValidate roda no blur', async (_, Input) => {
    const onChange = vi.fn();
    const onValidate = vi.fn();
    const { user } = renderWithProviders(
      <Input
        label="Campo"
        value=""
        onChange={onChange}
        onValidate={onValidate}
      />,
    );

    await user.type(screen.getByLabelText('Campo'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');

    await user.tab();
    expect(onValidate).toHaveBeenCalled();
  });

  it('FormTextInput com trim', async () => {
    const onChange = vi.fn();

    renderWithProviders(
      <FormTextInput
        label="Nome"
        value=""
        trim
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '  Ana ' } });
    expect(onChange).toHaveBeenCalledWith('Ana');
  });

  it('onValidate também roda quando o valor muda (não no primeiro render)', () => {
    const onValidate = vi.fn();
    const { rerender } = renderWithProviders(
      <FormTextInput
        label="X"
        value="a"
        onValidate={onValidate}
      />,
    );

    expect(onValidate).not.toHaveBeenCalled();

    rerender(
      <FormTextInput
        label="X"
        value="ab"
        onValidate={onValidate}
      />,
    );
    expect(onValidate).toHaveBeenCalled();
  });

  it('FormDatePicker e FormDateTimePicker são inputs nativos de data', () => {
    renderWithProviders(
      <>
        <FormDatePicker
          label="Data"
          value="2026-01-02"
        />

        <FormDateTimePicker
          label="Data e hora"
          value="2026-01-02T10:00"
        />
      </>,
    );

    expect(screen.getByLabelText('Data')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Data e hora')).toHaveAttribute('type', 'datetime-local');
  });
});

describe('FormNumberInput', () => {
  it('onChange recebe o número', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <FormNumberInput
        label="Qtd"
        value={1}
        onChange={onChange}
      />,
    );

    await user.type(screen.getByLabelText('Qtd'), '2');
    expect(onChange).toHaveBeenCalledWith(12);
  });
});

describe('FormSwitch', () => {
  it('onChange recebe o boolean', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <FormSwitch
        label="Ativo"
        value={false}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText('Ativo'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('FormSelect / FormMultiSelect', () => {
  const courses = [{ id: 'c1', name: 'Curso 1' }, { id: 'c2', name: 'Curso 2' }];

  it('modo objeto (valueField/labelField): onChange recebe o value', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <FormSelect
        label="Curso"
        data={courses}
        valueField="id"
        labelField="name"
        value={null}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: 'Curso' }));
    await user.click(await screen.findByRole('option', { name: 'Curso 2', hidden: true }));

    expect(onChange).toHaveBeenCalledWith('c2');
  });

  it('modo direto', () => {
    renderWithProviders(
      <FormSelect
        label="Status"
        data={['Ativo', 'Inativo']}
        value="Ativo"
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('Ativo');
  });

  it('FormMultiSelect com valores', () => {
    renderWithProviders(
      <FormMultiSelect
        label="Cursos"
        data={courses}
        valueField="id"
        labelField={(course: { name: string }) => course.name.toUpperCase()}
        value={['c1']}
      />,
    );

    expect(screen.getAllByText('CURSO 1').length).toBeGreaterThan(0);
  });

  it('sem data → lista vazia', () => {
    renderWithProviders(
      <>
        <FormSelect label="A" />

        <FormMultiSelect label="B" />
      </>,
    );

    expect(screen.getByRole('combobox', { name: 'A' })).toBeInTheDocument();
  });
});

describe('FormAutocomplete', () => {
  it('busca com debounce de 500ms e onChange recebe o value da opção', async () => {
    const onComplete = vi.fn();
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <FormAutocomplete
        label="Aluno"
        data={[{ id: 's1', name: 'Ana' }, { id: 's2', name: 'Bruno' }]}
        valueField="id"
        labelField="name"
        onComplete={onComplete}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Aluno');

    await user.type(input, 'Br');
    expect(onComplete).not.toHaveBeenCalled();
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('Br'), { timeout: 1500 });

    await user.click(await screen.findByRole('option', { name: 'Bruno', hidden: true }));

    expect(onChange).toHaveBeenCalledWith('s2');
    expect(input).toHaveValue('Bruno');
  });

  it('modo array de strings, com limite', async () => {
    const { user } = renderWithProviders(
      <FormAutocomplete
        label="Cidade"
        data={['A', 'B', 'C']}
        limit={2}
      />,
    );

    await user.click(screen.getByLabelText('Cidade'));

    expect(await screen.findAllByRole('option', { hidden: true })).toHaveLength(2);
  });
});

describe('FormButton', () => {
  it('label, ícone e tooltip', async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(
      <>
        <FormButton
          label="Novo"
          rightIcon="lucide:plus"
          leftIcon="lucide:x"
          onClick={onClick}
        />

        <FormButton
          icon="lucide:trash-2"
          tooltip="Excluir"
          aria-label="Excluir"
        />
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Novo' }));
    expect(onClick).toHaveBeenCalled();

    await user.hover(screen.getByRole('button', { name: 'Excluir' }));
    expect(await screen.findByText('Excluir', { selector: '.mantine-Tooltip-tooltip' })).toBeInTheDocument();
  });
});

describe('UtilsTable', () => {
  type Row = { id: number; name: string; status: string };

  const rows: Row[] = [{ id: 1, name: 'Ana', status: 'ok' }, { id: 2, name: 'Bruno', status: 'pendente' }];

  it('colunas, células customizadas, ações e paginação', async () => {
    const onAction = vi.fn();
    const setPage = vi.fn();
    const { user } = renderWithProviders(
      <UtilsTable
        title="Jogadores"
        rows={rows}
        rowKey={({ item }) => item.id}
        columns={{ name: 'Nome', status: 'Status' }}
        renderCells={{ status: ({ item }) => <b>{item.status.toUpperCase()}</b> }}
        actions={({ item }) => [{ label: `Remover ${item.name}`, icon: 'lucide:trash-2', onClick: onAction }]}
        page={1}
        lastPage={3}
        setPage={setPage}
      />,
    );

    expect(screen.getByText('Jogadores')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeInTheDocument();
    expect(screen.getByText('PENDENTE')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover Bruno' }));
    expect(onAction).toHaveBeenCalledWith({ item: rows[1], index: 1 });

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('vazio', () => {
    renderWithProviders(
      <UtilsTable
        rows={[]}
        columns={{ name: 'Nome' }}
        emptyText="Ninguém aqui."
        actions={[{ label: 'x' }]}
      />,
    );

    expect(screen.getByText('Ninguém aqui.')).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  function Boom(): never {
    throw new Error('falhou');
  }

  it('mostra o fallback quando um filho quebra', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithProviders(
      <ErrorBoundary fallback={<p>Deu ruim</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Deu ruim')).toBeInTheDocument();
  });

  it('sem fallback, usa a mensagem traduzida', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithProviders(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(i18n.t('errorBoundary.title'))).toBeInTheDocument();
  });

  it('sem erro, renderiza os filhos', () => {
    renderWithProviders(<ErrorBoundary><p>ok</p></ErrorBoundary>);

    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});

describe('LanguageSwitcher', () => {
  it('troca o idioma e lembra a escolha', async () => {
    const { user } = renderWithProviders(<LanguageSwitcher />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: i18n.t('language.en-us'), hidden: true }));

    expect(i18n.language).toBe('en-us');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en-us');

    await act(async () => {
      await i18n.changeLanguage('pt-br');
    });
  });
});

describe('UtilsServiceWorker', () => {
  it('só registra o service worker em produção', () => {
    const register = vi.fn(async () => ({}));

    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });

    renderWithProviders(<UtilsServiceWorker />);
    expect(register).not.toHaveBeenCalled();

    vi.stubEnv('NODE_ENV', 'production');
    renderWithProviders(<UtilsServiceWorker />);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  });
});
