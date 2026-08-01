use samira;
CREATE TABLE IF NOT EXISTS redes_publicacion_tipos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_redes_publicacion_tipos_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redes_plataformas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_redes_plataformas_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redes_nro_publicacion (
  id TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
  nro_publicacion INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO redes_nro_publicacion (id, nro_publicacion)
VALUES (1, 0)
ON DUPLICATE KEY UPDATE nro_publicacion = nro_publicacion;

CREATE TABLE IF NOT EXISTS redes_publicaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nro_publicacion INT NOT NULL,
  nombre VARCHAR(180) NOT NULL,
  fecha DATE NOT NULL,
  tipo_id INT NOT NULL,
  estado ENUM('Pendiente', 'En Proceso', 'Finalizado') NOT NULL DEFAULT 'Pendiente',
  umbral_alerta INT NOT NULL DEFAULT 1,
  creado_por INT NULL,
  actualizado_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_redes_publicaciones_nro (nro_publicacion),
  KEY idx_redes_publicaciones_fecha (fecha),
  KEY idx_redes_publicaciones_estado (estado),
  CONSTRAINT fk_redes_publicaciones_tipo
    FOREIGN KEY (tipo_id) REFERENCES redes_publicacion_tipos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redes_publicacion_plataformas (
  publicacion_id INT NOT NULL,
  plataforma_id INT NOT NULL,
  PRIMARY KEY (publicacion_id, plataforma_id),
  CONSTRAINT fk_redes_pub_plataformas_publicacion
    FOREIGN KEY (publicacion_id) REFERENCES redes_publicaciones (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_redes_pub_plataformas_plataforma
    FOREIGN KEY (plataforma_id) REFERENCES redes_plataformas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS redes_publicacion_articulos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  publicacion_id INT NOT NULL,
  articulo VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_redes_pub_articulos (publicacion_id, articulo),
  KEY idx_redes_pub_articulos_articulo (articulo),
  CONSTRAINT fk_redes_pub_articulos_publicacion
    FOREIGN KEY (publicacion_id) REFERENCES redes_publicaciones (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO redes_publicacion_tipos (nombre)
VALUES ('Reel'), ('Publicacion'), ('Historia')
ON DUPLICATE KEY UPDATE activo = 1;

INSERT INTO redes_plataformas (nombre)
VALUES ('Instagram'), ('TikTok')
ON DUPLICATE KEY UPDATE activo = 1;
