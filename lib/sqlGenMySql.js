/*!
* sql-soar
* authors: Ben Lue
* license: MIT License
* Copyright(c) 2015 Gocharm Inc.
*/
var  util = require('util');

var  _debug = false,
	 _NL = ' ',
	 _noArgOP = ['IS NOT NULL', 'IS NULL'];

/* turn on/off debug */
exports.setDebug = function setDebug(b)  {
	_NL = (_debug = b)  ?  '\n' : ' ';
};


exports.createTable = function(schema)  {
	var  debug = _debug || schema.debug,
		 sql = util.format('CREATE TABLE %s\n(\n', schema.title);
		 
	for (var i in schema.columns)  {
		var  c = schema.columns[i],
			 s = util.format('  %s\t\t%s', c.title, c.type);

		if (c.options)  {
			var  opt = c.options;
			if (opt.notNull)
				s += ' NOT NULL';
			if (opt.hasOwnProperty('default'))
				s += ' DEFAULT ' + opt.default;
			if (opt.autoInc)
				s += ' AUTO_INCREMENT';
			if (opt.comment)
				s += " COMMENT '" + opt.comment + "'";
		}
		sql += s + ',\n'
	}

	sql += '  primary key (';
	var  pk = '';
	for (var i in schema.primary)  {
		if (i > 0)
			pk += ', ';
		pk += schema.primary[i];
	}
	sql += pk + ')\n)';

	// adding table options
	var  opts = '';
	if (schema.options)  {
		var  opt = schema.options;
		for (var k in opt)  {
			if (opts)
				opts += ' ';
			if (k === 'comment')
				opts += "COMMENT = '" + opt.comment + "'";
			else
				opts += k + ' = ' + opt[k];
		}
	}

	if (opt)
		sql += '\n' + opts + ';';
	else
		sql += ';';

	if (debug)  {
		console.log('SQL[Create table]-----');
		console.log(sql);
	}
	return  sql;
};


exports.alterTable = function(schema)  {
	var  sql = util.format('ALTER TABLE %s\n', schema.title),
		 alterSpec,
		 debug = _debug || schema.debug;

	if (schema.add)  {
		if (schema.add.column)  {
			var  columns = schema.add.column;
			for (var i in columns)  {
				var  c = columns[i],
					 s = util.format('ADD COLUMN %s\t%s', c.title, c.type);

				if (c.options)  {
					var  opt = c.options;
					if (opt.notNull)
						s += ' NOT NULL';
					if (opt.hasOwnProperty('default'))
						s += ' DEFAULT ' + opt.default;
					if (opt.autoInc)
						s += ' AUTO_INCREMENT';
					if (opt.comment)
						s += " COMMENT '" + opt.comment + "'";
				}
				if (alterSpec)
					alterSpec += ',\n' + s;
				else
					alterSpec = s;
			}
		}

		if (schema.add.index)  {
			var  indexes = schema.add.index;
			for (var key in indexes)  {
				var  idx = indexes[key],
					 isUnique = idx.unique  ?  ' UNIQUE' : '';

				var  idxSQL = '';
				for (var i in idx.columns)  {
					if (idxSQL)
						idxSQL += ', ' + idx.columns[i];
					else
						idxSQL = idx.columns[i];
				}

				var  s = util.format('ADD%s INDEX %s (%s)', isUnique, key, idxSQL);
				if (alterSpec)
					alterSpec += ',\n' + s;
				else
					alterSpec = s;
			}
		}

		if (schema.add.foreignKey)  {
			var  fkeys = schema.add.foreignKey;
			for (var key in fkeys)  {
				var  fk = fkeys[key],
					 delInt = 'restrict',
					 updInt = 'restrict',
					 reference = fk.reference;

				if (fk.integrity)  {
					delInt = fk.integrity.delete || delInt;
					updInt = fk.integrity.update || updInt;
				}

				var  idx = reference.indexOf('.'),
					 refTable = reference.substring(0, idx),
					 refCol = reference.substring(idx+1),
					 s = util.format('ADD CONSTRAINT %s FOREIGN KEY (%s) references %s (%s) ON DELETE %s ON UPDATE %s', key, fk.key, refTable, refCol, delInt, updInt);
				if (alterSpec)
					alterSpec += ',\n' + s;
				else
					alterSpec = s;
			}
		}
	}
	
	if (schema.alter)  {
		if (schema.alter.column)  {
			var  columns = schema.alter.column;
			for (var i in columns)  {
				var  c = columns[i],
					 s;
				
				if (c.name)
					s = util.format('CHANGE COLUMN `%s` `%s` %s', c.title, c.name, c.type);
				else
					s = util.format('MODIFY COLUMN `%s` %s', c.title, c.type);
				
				if (s)	{
					if (alterSpec)
						alterSpec += ',\n' + s;
					else
						alterSpec = s;
				}
			}
		}
	}

	if (schema.drop)  {
		if (schema.drop.column)  {
			var  columns = schema.drop.column;
			for (var i in columns)  {
				var  s = 'DROP COLUMN ' + columns[i];
				if (alterSpec)
					alterSpec += ',\n' + s;
				else
					alterSpec = s;
			}
		}

		if (schema.drop.index)  {
			var  indexes = schema.drop.index;
			for (var i in indexes)  {
				var  s = 'DROP INDEX ' + indexes[i];
				if (alterSpec)
					alterSpec += ',\n' + s;
				else
					alterSpec = s;
			}
		}

		if (schema.drop.foreignKey)  {
			var  keys = schema.drop.foreignKey;
			for (var i in keys)  {
				var  s = 'DROP FOREIGN KEY ' + keys[i];
				if (alterSpec)
					alterSpec += ',\n' + s;
				else
					alterSpec = s;
			}
		}
	}

	sql += alterSpec + ';';

	if (debug)  {
		console.log('SQL[Alter table]-----');
		console.log(sql);
	}
	return  sql;
};


exports.toSQL = function(options, data, query, p)  {
	var  sql,
		 op = options.op,
		 expr = options.expr,
		 fld = options.fields,
		 debug = _debug || options.debug;

	switch (op)  {
		case 'query':
			sql = genQuery(expr, query, p, fld, debug);
			break;

		case 'list':
			var  range = options.range;
			sql = genList(expr, query, p, range, fld, debug);
			break;
			
		case  'listCount':
			sql = genListCount(expr, query, p);
			break;

		case 'insert':
			sql = genInsert(expr, data, p, debug);
			break;

		case 'update':
			sql = genUpdate(expr, data, query, p, debug);
			break;

		case 'delete':
			sql = genDelete(expr, query, p, debug);
			break;
	}
	return  sql;
};


function  genQuery(expr, q, p, fld, debug)  {
	var  sql = composeQ(expr, q, p, fld, debug);
	if (sql.length > 0)
		sql += _NL + 'LIMIT 1;';
	else
		sql += ';';

	return  sql;
};


function genList(expr, q, p, range, fields, debug)  {
	var  sql = composeQ( expr, q, p, fields, debug );
	if (sql) {
		if (range)
			sql += _NL + 'LIMIT ' + range.getIndex() + ', ' + range.getPageSize() + ';';
		else
			sql += ';';
	}

	return  sql;
};


function genInsert(expr, data, p, debug)  {
	if (!data)
		throw  new Error('Missing insert data');

	var  table = expr.table,
		 fields = expr.columns;

	var  sql = 'INSERT INTO `' + rectifyTable(table) + '` (`',
		 notFirst = false;
	fields.forEach( function(f) {
		if (data.hasOwnProperty(f))  {
			if (notFirst)
				sql += '`, `';
			sql += f;
			notFirst = true;

			p.push( data[f] );
		}
	});

	sql += '`) VALUES (?';
	for (var i = 1, len = p.length; i < len; i++)
		sql += ', ?';
	sql += ');';

	if (debug)  {
		console.log('SQL-----');
		console.log(sql);
		console.log('Arguments------');
		console.log(p);
	}

	return  sql;
};


function genUpdate(expr, data, terms, p, debug)  {
	if (!data)
		throw  new Error('Missing update data');

	var  table = expr.table,
		 fields = expr.columns;

	var  //sql = 'UPDATE `' + rectifyTable(table) + '`' + _NL + 'SET `',
		 sql = util.format('UPDATE `%s`%sSET `', rectifyTable(table), _NL),
		 notFirst = false;
	fields.forEach( function(f) {
		if (data.hasOwnProperty(f))  {
			if (notFirst)
				sql += ', `';
			sql += f + '`=?';
			notFirst = true;

			p.push( data[f] );
		}
	});

	// where...
	var  filter = expr.filters;
	if (filter)  {
		var  s = matchFilter(filter, terms, p);
		if (s.length > 0)
			sql += _NL + 'WHERE ' + s;
	}
	sql += ';';

	if (debug)  {
		console.log('SQL-----');
		console.log(sql);
		console.log('Arguments------');
		console.log(p);
	}

	return  sql;
};


function genDelete(expr, terms, p, debug)  {
	var  table = expr.table,
		 //sql = 'DELETE FROM ' + rectifyTable(table);
		 sql = util.format('DELETE FROM `%s`', rectifyTable(table));

	// where...
	var  filter = expr.filters;
	if (filter !== null)  {
		var  s = matchFilter(filter, terms, p);
		if (s.length > 0)
			sql += _NL + 'WHERE ' + s;
	}
	sql += ';';

	if (debug)  {
		console.log('SQL-----');
		console.log(sql);
		console.log('Arguments------');
		console.log(p);
	}

	return  sql;
};


function genListCount(expr, q, p)  {
	var  table = expr.table,
		 sql = 'SELECT COUNT(*) AS ct FROM ' + rectifyTable(table);
		 
	if (table.join)  {
		table.join.forEach( function(jt) {
			sql += _NL;
			if (jt.type)
				sql += ' ' + jt.type + ' ';
			sql += 'JOIN ' + jt.table;

			if (jt.use)
				sql += ' USING(`' + jt.use + '`)';
			else
				sql += ' ON ' + jt.onWhat;
		});
	}
	
	// where...
	var  filter = expr.filters;
	if (filter)  {
		var  s = matchFilter(filter, q, p);
		if (s.length > 0)
			sql += _NL + 'WHERE ' + s;
	}
	
	return  sql + ';';
};


function composeQ(expr, q, p, fld, debug)  {
	var  table = expr.table,
		 fields = expr.columns;

	var  sql = 'SELECT ',
		 notFirst = false;

	if (fld)
		// pick up only selected fields
		fields.forEach( function(f)  {
			if (fld.indexOf(f) >= 0)  {
				if (notFirst)
					sql += ', ';
				else
					notFirst = true;

				sql += f;
			}
		});
	else
		fields.forEach( function(f) {
			if (notFirst)
				sql += ', ';
			else
				notFirst = true;

			sql += f;
		});

	// from ...
	sql += _NL + 'FROM ' + rectifyTable(table);
	if (table.join)  {
		table.join.forEach( function(jt) {
			sql += _NL;
			if (jt.type)
				sql += ' ' + jt.type + ' ';
			sql += 'JOIN ' + jt.table;

			if (jt.use)
				sql += ' USING(`' + jt.use + '`)';
			else
				sql += ' ON ' + jt.onWhat;
		});
	}

	// where...
	var  filter = expr.filters;
	if (filter)  {
		var  s = matchFilter(filter, q, p);
		if (s.length > 0)
			sql += _NL + 'WHERE ' + s;
	}

	// extra
	if (expr.extra)
		sql += _NL + expr.extra;

	if (debug)  {
		console.log('SQL-----');
		console.log(sql);
		console.log('Arguments------');
		console.log(p);
	}

	return  sql;
};


function  matchFilter(filter, q, p)  {
	var  op = filter.op,
		 sql = '';

	if (op === 'AND' || op === 'and' || op === 'OR' || op === 'or')  {
		var  hit = false;
		op = op.toUpperCase();

		filter.filters.forEach(function(f)  {
			var  s = matchFilter(f, q, p);
			if (s)  {
				//sql = sql ? (sql + ' ' + op + ' ' + s) : s;
				sql = sql  ?  util.format('%s %s %s', sql, op, s) : s;
				hit = true;
			}
		});
		if (hit)
			sql = '(' + sql + ')';
	}
	else  {
		var  fname = filter.name,
			 idx = fname.indexOf('.');

		if (idx > 0)
			fname = fname.substring(idx+1);

		if (q.hasOwnProperty(fname))  {
			sql = filter.field || filter.name;
			if (op)  {
				sql += ' ' + op;
				
				if (_noArgOP.indexOf(op) < 0)  {
					if (!filter.noArg)  {
						p.push( q[fname] );
						sql += ' ?';
					}
				}
			}
			else  {
				p.push( q[fname] );
				//sql += '=?';
			}
		}
	}

	return  sql;
};

function  rectifyTable(table)  {
	var  name = table.name,
		 idx = name.indexOf('.');
	return  idx > 0  ?  name.substring(idx+1) : name;
}