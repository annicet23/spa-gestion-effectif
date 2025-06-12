import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';

const RoleBasedButton = ({
    userRole,
    requiredRole = 'Admin', // CORRIGÉ : Majuscule par défaut
    canAccess = true,
    children,
    tooltipText = 'Accès non autorisé',
    icon,
    ...props
}) => {
    // CORRIGÉ : Vérifier avec les bons rôles (majuscules)
    const hasAccess = userRole === 'Admin' || canAccess;

    if (!hasAccess) {
        return (
            <OverlayTrigger
                placement="top"
                overlay={<Tooltip>{tooltipText}</Tooltip>}
            >
                <span>
                    <Button {...props} disabled style={{ pointerEvents: 'none' }}>
                        {icon && <span className="me-1">{icon}</span>}
                        {children}
                    </Button>
                </span>
            </OverlayTrigger>
        );
    }

    return (
        <Button {...props}>
            {icon && <span className="me-1">{icon}</span>}
            {children}
        </Button>
    );
};

export default RoleBasedButton;