import { ComponentEx, translate } from '../util/ComponentEx';
import { didIgnoreError, isOutdated } from '../util/errorHandling';
import { genHash } from '../util/genHash';

import Icon from './Icon';
import { IconButton } from './TooltipControls';

import { remote } from 'electron';
import * as _ from 'lodash';
import * as React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';

export type CBFunction = (...args: any[]) => void;

export interface IErrorContext {
  safeCB: (cb: CBFunction, dependencyList?: any[]) => CBFunction;
}

export const ErrorContext = React.createContext<IErrorContext>({
  safeCB: cb => cb,
});

export interface IErrorBoundaryProps extends WithTranslation {
  visible?: boolean;
  onHide?: () => void;
  className?: string;
}

interface IErrorBoundaryState {
  error: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends ComponentEx<IErrorBoundaryProps, IErrorBoundaryState> {
  private mErrContext: IErrorContext;
  constructor(props: IErrorBoundaryProps) {
    super(props);

    this.state = {
      error: undefined,
      errorInfo: undefined,
    };

    this.mErrContext = {
      safeCB: (cb: CBFunction): CBFunction => {
        return (...args) => {
          try {
            cb(...args);
          } catch (err) {
            this.setState({ error: err });
          }
        };
      },
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  public render(): React.ReactNode {
    const { t, className, onHide, visible } = this.props;
    const { error } = this.state;

    if (error === undefined) {
      return (
        <ErrorContext.Provider value={this.mErrContext}>
          {React.Children.only(this.props.children)}
        </ErrorContext.Provider>
      );
    }

    const classes = (className || '').split(' ');
    classes.push('errorboundary');

    return visible ? (
      <div className={classes.join(' ')}>
        <Alert className='render-failure' bsStyle='danger'>
          <Icon className='render-failure-icon' name='sad' />
          <div className='render-failure-text'>{t('Failed to render.')}</div>
          <div className='render-failure-buttons'>
            {(isOutdated() || didIgnoreError())
              ? null
              : <Button onClick={this.report}>{t('Report')}</Button>}
            <Button onClick={this.retryRender}>{t('Retry')}</Button>
          </div>
          {(onHide !== undefined)
            ? (
              <IconButton
                className='error-boundary-close'
                tooltip={t('Hide')}
                icon='close'
                onClick={onHide}
              />)
              : null}
        </Alert>
      </div>
      ) : null;
  }

  private report = () => {
    const { events } = this.context.api;
    const { onHide } = this.props;
    const { error, errorInfo } = this.state;
    if (onHide !== undefined) {
      onHide();
    }
    let errMessage = 'Component rendering error\n\n'
                   + `Vortex Version: ${remote.app.getVersion()}\n\n`
                   + `${error.stack}`;

    if (errorInfo !== undefined) {
      errMessage += '\n\nComponentStack:'
                  + errorInfo.componentStack + '\n';
    }

    events.emit('report-feedback', error.stack.split('\n')[0], errMessage,
                [], genHash(error));
  }

  private retryRender = () => {
    this.setState({ error: undefined, errorInfo: undefined });
  }
}

export default translate(['common'])(ErrorBoundary);

/**
 * Higher-Order-Component that provides the component with a safeCB callback wrapper
 * which will get all exceptions from the callback forwarded to the nearest ErrorBoundary
 * so that they get reported properly instead of remaining unhandled.
 */
export function safeCallbacks<T, S>(
  ComponentToWrap: React.ComponentType<React.PropsWithChildren<T>>,
): React.ComponentType<Omit<T, keyof IErrorContext>> {
  // tslint:disable-next-line:class-name
  // return class __SafeCallbackComponent extends React.Component<T, S> {
  const cache: { [key: string]: { cb: CBFunction, depList: any[] } } = {};

  return (props: React.PropsWithChildren<T>) => {
    const context = React.useContext(ErrorContext);

    const cachingSafeCB = React.useCallback((cb: (...args: any[]) => void, depList?: any[]) => {
      const id = cb.toString();
      if ((cache[id] === undefined)
          || (depList !== undefined) && !_.isEqual(depList, cache[id].depList)) {
        cache[id] = { cb: context.safeCB(cb, []), depList };
      }
      return cache[id].cb;
    }, [context]);

    return React.createElement(ComponentToWrap, {
      ...props,
      safeCB: cachingSafeCB,
    },
    props.children);
  };
}
