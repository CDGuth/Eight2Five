import React from 'react';
import {
  createIcon as createGluestackIcon,
  type IPrimitiveIcon,
  PrimitiveIcon,
  Svg,
} from '@gluestack-ui/core/icon/creator';
import {
  tva,
  type VariantProps,
} from '@gluestack-ui/utils/nativewind-utils';
import { withUniwind } from 'uniwind';

export const UIIcon = createGluestackIcon({
  Root: PrimitiveIcon,
}) as React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof PrimitiveIcon> &
    React.RefAttributes<React.ComponentRef<typeof Svg>>
>;

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

const StyledUIIcon = withUniwind(UIIcon);

type IconSize = VariantProps<typeof iconStyle>['size'] | number;
type IIconProps = Omit<
  IPrimitiveIcon & React.ComponentPropsWithoutRef<typeof UIIcon>,
  'size'
> &
  Omit<VariantProps<typeof iconStyle>, 'size'> & {
    size?: IconSize;
  };

const Icon = React.forwardRef<React.ComponentRef<typeof UIIcon>, IIconProps>(
  function Icon({ size = 'md', className, ...props }, ref) {
    if (typeof size === 'number') {
      return (
        <StyledUIIcon
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
        <StyledUIIcon
          ref={ref}
          {...props}
          className={iconStyle({ class: className })}
        />
      );
    }
    return (
      <StyledUIIcon
        ref={ref}
        {...props}
        className={iconStyle({ size, class: className })}
      />
    );
  }
);

type CreateIconParameters = Omit<
  Parameters<typeof createGluestackIcon>[0],
  'Root'
>;

const createIcon = ({ ...props }: CreateIconParameters) => {
  const CreatedUIIcon = createGluestackIcon({
    Root: Svg,
    ...props,
  }) as React.ForwardRefExoticComponent<
    React.ComponentPropsWithoutRef<typeof PrimitiveIcon> &
      React.RefAttributes<React.ComponentRef<typeof Svg>>
  >;

  return React.forwardRef<React.ComponentRef<typeof Svg>>(function UIIcon(
    {
      className,
      size,
      ...incomingProps
    }: VariantProps<typeof iconStyle> &
      React.ComponentPropsWithoutRef<typeof CreatedUIIcon>,
    ref
  ) {
    return (
      <CreatedUIIcon
        ref={ref}
        {...incomingProps}
        className={iconStyle({ size, class: className })}
      />
    );
  });
};

export { createIcon, Icon };
