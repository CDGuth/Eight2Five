import React from 'react';
import {
  createIcon as createGluestackIcon,
  PrimitiveIcon,
  Svg,
} from '@gluestack-ui/core/icon/creator';
import {
  tva,
  type VariantProps,
} from '@gluestack-ui/utils/nativewind-utils';

export const UIIcon = createGluestackIcon({
  Root: PrimitiveIcon,
});

const iconStyle = tva({
  base: 'text-foreground fill-none pointer-events-none',
  variants: {
    size: {
      '2xs': 'h-3 w-3',
      'xs': 'h-3.5 w-3.5',
      'sm': 'h-4 w-4',
      'md': 'h-[18px] w-[18px]',
      'lg': 'h-5 w-5',
      'xl': 'h-6 w-6',
    },
  },
});

const Icon = React.forwardRef<
  React.ComponentRef<typeof UIIcon>,
  Omit<React.ComponentPropsWithoutRef<typeof UIIcon>, 'size'> &
    Omit<VariantProps<typeof iconStyle>, 'size'> & {
      height?: number | string;
      size?: VariantProps<typeof iconStyle>['size'] | number;
      width?: number | string;
    }
>(function Icon({ size = 'md', className, ...props }, ref) {
  if (typeof size === 'number') {
    return (
      <UIIcon
        // @ts-expect-error : TODO: fix this
        ref={ref}
        {...props}
        className={iconStyle({ class: className })}
        size={size}
      />
    );
  } else if (
    (props.height !== undefined || props.width !== undefined) &&
    size === undefined
  ) {
    return (
      <UIIcon
        // @ts-expect-error : TODO: fix this
        ref={ref}
        {...props}
        className={iconStyle({ class: className })}
      />
    );
  }
  return (
    <UIIcon
      // @ts-expect-error : TODO: fix this
      ref={ref}
      {...props}
      className={iconStyle({ size, class: className })}
    />
  );
});

type CreateIconParameters = Omit<
  Parameters<typeof createGluestackIcon>[0],
  'Root'
>;

const accessClassName = (style: any) => {
  const styleObject = Array.isArray(style) ? style[0] : style;
  const keys = Object.keys(styleObject);
  return styleObject[keys[1]];
};

const createIcon = ({ ...props }: CreateIconParameters) => {
  const CreatedUIIcon = createGluestackIcon({ Root: Svg, ...props });
  return React.forwardRef<
    React.ComponentRef<typeof UIIcon>,
    React.ComponentPropsWithoutRef<typeof UIIcon> &
      VariantProps<typeof iconStyle> & {
        height?: number | string;
        width?: number | string;
      }
  >(function UIIcon({ className, ...incomingProps }, ref) {
    const calculatedClassName = React.useMemo(() => {
      return className === undefined
        ? accessClassName(incomingProps?.style)
        : className;
    }, [className, incomingProps?.style]);
    return (
      <CreatedUIIcon
        // @ts-expect-error : TODO: fix this
        ref={ref}
        {...incomingProps}
        className={calculatedClassName}
      />
    );
  });
};

export { createIcon, Icon };
