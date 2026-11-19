import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UtilsIf } from '@/components/utils/If';
import { UtilsFor } from '@/components/utils/For';
import { UtilsLoader } from '@/components/utils/Loader';
import { UtilsCard } from '@/components/utils/Card';
import { Form } from '@/components/form/Form';

describe('UtilsIf', () => {
  it('modo condition', () => {
    const { rerender } = render(
      <UtilsIf condition={false}>
        {() => <p>visível</p>}
      </UtilsIf>,
    );

    expect(screen.queryByText('visível')).not.toBeInTheDocument();

    rerender(
      <UtilsIf condition={1}>
        {() => <p>visível</p>}
      </UtilsIf>,
    );

    expect(screen.getByText('visível')).toBeInTheDocument();
  });

  it('modo cases: primeiro caso verdadeiro, e o caso sem condição como else', () => {
    render(
      <UtilsIf
        cases={[
          { condition: false, content: () => <p>a</p> },
          { condition: true, content: () => <p>b</p> },
          { content: () => <p>else</p> },
        ]}
      />,
    );

    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.queryByText('else')).not.toBeInTheDocument();
  });

  it('modo cases sem nenhum caso verdadeiro e sem else → nada', () => {
    const { container } = render(<UtilsIf cases={[{ condition: false, content: () => <p>a</p> }]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('UtilsFor', () => {
  it('renderiza cada item com índice', () => {
    render(
      <ul>
        <UtilsFor
          each={['x', 'y']}
          eachKey={({ item }) => item}
        >
          {({ item, index }) => <li>{`${index}:${item}`}</li>}
        </UtilsFor>
      </ul>,
    );

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['0:x', '1:y']);
  });

  it('lista vazia mostra o fallback', () => {
    render(
      <UtilsFor
        each={[]}
        empty={<p>Nada</p>}
      >
        {() => <span />}
      </UtilsFor>,
    );

    expect(screen.getByText('Nada')).toBeInTheDocument();
  });

  it('lista vazia sem fallback → nada', () => {
    const { container } = render(<UtilsFor each={[]}>{() => <span />}</UtilsFor>);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('UtilsLoader', () => {
  it('só monta quando aparece pela primeira vez e depois só esconde', () => {
    const child = vi.fn(() => <p>aba</p>);
    const { rerender, container } = render(<UtilsLoader show={false}>{child}</UtilsLoader>);

    expect(container).toBeEmptyDOMElement();

    rerender(<UtilsLoader show>{child}</UtilsLoader>);
    expect(screen.getByText('aba')).toBeVisible();

    rerender(<UtilsLoader show={false}>{child}</UtilsLoader>);
    expect(screen.getByText('aba')).not.toBeVisible();
  });
});

describe('UtilsCard', () => {
  it('aplica o padding padrão, removível com noPadding', () => {
    const { rerender } = render(<UtilsCard data-testid="card">conteúdo</UtilsCard>);

    expect(screen.getByTestId('card')).toHaveClass('p-6');

    rerender(<UtilsCard data-testid="card" noPadding>conteúdo</UtilsCard>);
    expect(screen.getByTestId('card')).not.toHaveClass('p-6');
  });
});

describe('Form', () => {
  it('chama onSubmit sem recarregar a página', () => {
    const onSubmit = vi.fn();

    render(
      <Form onSubmit={onSubmit}>
        <button type="submit">
          Enviar
        </button>
      </Form>,
    );

    const event = fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(event).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
